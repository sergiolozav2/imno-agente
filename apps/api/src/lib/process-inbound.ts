import type { Payload } from 'payload'
import type { TenantContext } from '@imno/domain'
import { createEvolutionClient } from '@imno/integration-evolution'
import { loadEvolutionConfig } from '@imno/runtime-config'
import { requestClientReply } from './agent-client'
import { findInstanceNameForTenant } from './instance-tenant'
import { toId } from './payload-ids'

/**
 * Reply coordinator for one stored inbound message.
 *
 * By the time this runs, the receipt, the inbound message, and the work item are
 * already durable, so every exit path here is safe to retry and none of them can
 * lose the buyer's message. The API stays the only writer of message rows and
 * delivery state; the agent only supplies text.
 */

export interface ProcessInboundInput {
  context: TenantContext
  conversationId: string
  clientId: string
  inboundMessageId: string
  /** Provider event key, used to derive the outbound idempotency key. */
  eventKey: string
  buyerText: string
  recipientPhone: string
  instanceName: string
}

type ProcessOutcome =
  | { state: 'completed'; outboundMessageId: string; delivered: boolean }
  | { state: 'skipped'; reason: string }
  | { state: 'failed'; reason: string }

export async function processInbound(
  payload: Payload,
  input: ProcessInboundInput,
): Promise<ProcessOutcome> {
  const outcome = await runReply(payload, input)
  await recordProcessingState(payload, input.inboundMessageId, outcome)
  return outcome
}

async function runReply(payload: Payload, input: ProcessInboundInput): Promise<ProcessOutcome> {
  // A human has taken over this thread: store the buyer's message, stay silent.
  const conversation = await payload
    .findByID({
      collection: 'conversations',
      id: input.conversationId,
      depth: 0,
      overrideAccess: true,
    })
    .catch(() => null)
  if ((conversation as { botPaused?: boolean } | null)?.botPaused === true) {
    return { state: 'skipped', reason: 'bot-paused' }
  }

  const agentBaseUrl = process.env.AGENT_INTERNAL_URL
  const secret = process.env.INTERNAL_SERVICE_SECRET
  if (!agentBaseUrl || !secret) {
    return { state: 'failed', reason: 'agent-not-configured' }
  }

  const reply = await requestClientReply(
    { baseUrl: agentBaseUrl, secret },
    {
      tenantId: input.context.tenantId,
      tenantSlug: input.context.tenantSlug,
      conversationId: input.conversationId,
      clientId: input.clientId,
      message: input.buyerText,
    },
  )
  if (!reply.ok) {
    return { state: 'failed', reason: reply.error.code }
  }

  // One reply per inbound event: a webhook retry that gets past the receipt gate
  // still collides on this key instead of double-messaging the buyer.
  const outboundKey = `${input.eventKey}:reply`
  let outboundMessageId: string
  try {
    const created = await payload.create({
      collection: 'messages',
      overrideAccess: true,
      data: {
        tenant: toId(input.context.tenantId),
        conversation: toId(input.conversationId),
        direction: 'outbound',
        author: 'ai',
        text: reply.value.text,
        idempotencyKey: outboundKey,
        deliveryState: 'pending',
      },
    })
    outboundMessageId = String(created.id)
  } catch {
    return { state: 'failed', reason: 'outbound-persist-failed' }
  }

  const delivery = await deliver(input, reply.value.text)

  await payload
    .update({
      collection: 'messages',
      id: outboundMessageId,
      overrideAccess: true,
      data: {
        deliveryState: delivery.state,
        ...(delivery.providerMessageId ? { providerMessageId: delivery.providerMessageId } : {}),
      },
    })
    .catch(() => null)

  return {
    state: 'completed',
    outboundMessageId,
    delivered: delivery.state === 'sent',
  }
}

async function deliver(
  input: ProcessInboundInput,
  text: string,
): Promise<{ state: 'sent' | 'failed'; providerMessageId?: string }> {
  const config = loadEvolutionConfig()
  if (!config.ok) return { state: 'failed' }

  const client = createEvolutionClient({
    baseUrl: config.value.baseUrl,
    apiKey: config.value.apiKey,
  })
  const sent = await client.sendText({
    instanceName: input.instanceName,
    to: input.recipientPhone,
    text,
  })
  if (!sent.ok) return { state: 'failed' }
  return {
    state: 'sent',
    ...(sent.value.providerMessageId ? { providerMessageId: sent.value.providerMessageId } : {}),
  }
}

/** Close out the work item so a retry sweep can tell done from stuck. */
async function recordProcessingState(
  payload: Payload,
  inboundMessageId: string,
  outcome: ProcessOutcome,
): Promise<void> {
  try {
    const found = await payload.find({
      collection: 'message-processing',
      where: { inboundMessage: { equals: inboundMessageId } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    const row = found.docs[0]
    if (!row) return

    await payload.update({
      collection: 'message-processing',
      id: row.id,
      overrideAccess: true,
      data: {
        state: outcome.state,
        attempts: (Number((row as { attempts?: number }).attempts) || 0) + 1,
        ...(outcome.state === 'completed' ? {} : { safeError: outcome.reason }),
      },
    })
  } catch {
    // Bookkeeping only: the durable message rows already reflect what happened.
  }
}

/** Resolve which WhatsApp line a tenant sends from, preferring an explicit name. */
export async function resolveSendingInstance(
  payload: Payload,
  tenantId: string,
  preferred?: string,
): Promise<string | null> {
  if (preferred && preferred.trim().length > 0) return preferred.trim()
  return findInstanceNameForTenant(payload, tenantId)
}
