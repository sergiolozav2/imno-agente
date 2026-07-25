import type { EvolutionWebhookInput } from '@imno/contracts'
import { constantTimeEqual, stableHash } from './crypto'

/**
 * Pure webhook decision helpers composed by the API webhook route. Ordering of
 * these checks is security-critical (see channels design):
 * auth -> accepted type -> tenant resolution -> echo -> dedup key.
 */

/** Accepted inbound-message event types. Everything else is acknowledged only. */
const ACCEPTED_EVENT_TYPES = new Set(['messages.upsert', 'messages.set'])

export function isAcceptedEventType(eventType: string): boolean {
  return ACCEPTED_EVENT_TYPES.has(eventType.trim().toLowerCase())
}

/**
 * Verify the webhook shared-secret / api-key using a constant-time comparison.
 */
export function verifyWebhookAuth(provided: string | null | undefined, expected: string): boolean {
  if (!provided || !expected) return false
  return constantTimeEqual(provided, expected)
}

/**
 * A Product_System outbound echo: the provider marks the event as sent by the
 * connected account. Echoes create zero buyer messages and zero work items.
 */
export function isOutboundEcho(
  input: Pick<EvolutionWebhookInput, 'fromConnectedAccount'>,
): boolean {
  return input.fromConnectedAccount === true
}

/**
 * Derive a stable provider event key for idempotency/dedup. Prefers the
 * provider event id, then message id; falls back to a deterministic hash of
 * immutable event fields when no stable id is present.
 */
export function deriveEventKey(input: EvolutionWebhookInput): string {
  const type = input.eventType.trim().toLowerCase()
  const stableId = input.eventId ?? input.messageId
  if (stableId) {
    return `${input.instanceName}:${type}:${stableId}`
  }
  const fingerprint = stableHash(
    [input.instanceName, type, input.sender, input.occurredAt ?? '', input.text ?? ''].join('|'),
  )
  return `${input.instanceName}:${type}:h:${fingerprint}`
}

export type WebhookAcceptDecision =
  | { action: 'reject-unauthorized' }
  | { action: 'acknowledge-ignored'; reason: 'unaccepted-event' | 'echo' }
  | { action: 'process'; eventKey: string }

export interface WebhookDecisionInput {
  input: EvolutionWebhookInput
  providedSecret: string | null | undefined
  expectedSecret: string
}

/**
 * Single entry point that runs the security-critical decision sequence and
 * returns what the route should do. It performs no I/O.
 */
export function decideWebhook(params: WebhookDecisionInput): WebhookAcceptDecision {
  if (!verifyWebhookAuth(params.providedSecret, params.expectedSecret)) {
    return { action: 'reject-unauthorized' }
  }
  if (!isAcceptedEventType(params.input.eventType)) {
    return { action: 'acknowledge-ignored', reason: 'unaccepted-event' }
  }
  if (isOutboundEcho(params.input)) {
    return { action: 'acknowledge-ignored', reason: 'echo' }
  }
  return { action: 'process', eventKey: deriveEventKey(params.input) }
}
