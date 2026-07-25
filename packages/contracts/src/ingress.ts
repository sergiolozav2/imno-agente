import { z } from 'zod'

/**
 * Untrusted trust-boundary DTOs. These are NOT domain messages: they carry no
 * authoritative tenant, conversation, or client IDs. They live separate from
 * the shared message contract and are only converted after authentication.
 */

export const evolutionWebhookInputSchema = z.object({
  instanceName: z.string().min(1),
  eventType: z.string().min(1),
  eventId: z.string().optional(),
  messageId: z.string().optional(),
  sender: z.string().min(1),
  fromConnectedAccount: z.boolean(),
  occurredAt: z.string().optional(),
  text: z.string().optional(),
})
export type EvolutionWebhookInput = z.infer<typeof evolutionWebhookInputSchema>

export const publicChatInputSchema = z.object({
  publicSessionToken: z.string().min(1),
  text: z.string().min(1).max(4000),
  clientRequestId: z.string().min(1),
})
export type PublicChatInput = z.infer<typeof publicChatInputSchema>

/** Request to start/resume a public chat session, exchanged for a token. */
export const publicChatInitInputSchema = z.object({
  tenantPublicKey: z.string().min(1),
})
export type PublicChatInitInput = z.infer<typeof publicChatInitInputSchema>
