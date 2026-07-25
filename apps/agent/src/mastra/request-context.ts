import { RequestContext } from '@mastra/core/request-context'
import { z } from 'zod'

/**
 * The per-turn execution context every tool reads from.
 *
 * Tenancy lives here — not in a tool argument — precisely so the model cannot
 * influence it. The HTTP handler builds this from the authenticated caller's
 * payload before the agent runs, and tools treat it as read-only truth.
 */
export interface AgentRequestContext extends Record<string, unknown> {
  /** Tenant that owns every row this turn may touch. */
  tenantId: string
  tenantSlug: string
  /** Reply language for buyer-facing text. */
  language: string
  /** Buyer record backing a WhatsApp conversation (client agent only). */
  clientId?: string
  /** Persisted conversation id (client agent only). */
  conversationId?: string
  /** Operator-selected `system_` Evolution instance, when one is chosen. */
  systemInstanceName?: string
  /** Memory resource id owning this turn's threads, used for session recall. */
  memoryResource?: string
  /** Thread id of the current turn, so recall can exclude it. */
  memoryThread?: string
}

export const agentRequestContextSchema = z.object({
  tenantId: z.string().min(1),
  tenantSlug: z.string().min(1),
  language: z.string().min(1),
  clientId: z.string().optional(),
  conversationId: z.string().optional(),
  systemInstanceName: z.string().optional(),
  memoryResource: z.string().optional(),
  memoryThread: z.string().optional(),
})

export function buildRequestContext(
  values: AgentRequestContext,
): RequestContext<AgentRequestContext> {
  const context = new RequestContext<AgentRequestContext>()
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined) {
      context.set(key as keyof AgentRequestContext, value as never)
    }
  }
  return context
}

export interface ToolExecutionContext {
  requestContext?: {
    get: (key: string) => unknown
  }
}

/** Read a required context value, failing loudly rather than defaulting. */
export function requireContextValue(context: ToolExecutionContext | undefined, key: string): string {
  const value = context?.requestContext?.get(key)
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Missing required request context value: ${key}`)
  }
  return value
}

export function optionalContextValue(
  context: ToolExecutionContext | undefined,
  key: string,
): string | undefined {
  const value = context?.requestContext?.get(key)
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

/** The tenant id for the current turn. Always server-derived. */
export function tenantIdFrom(context: ToolExecutionContext | undefined): string {
  return requireContextValue(context, 'tenantId')
}
