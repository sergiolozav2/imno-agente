import { z } from 'zod'
import { channelSchema } from './enums'

/**
 * The authoritative, provider-neutral shared message contract used by both
 * WhatsApp and public web chat. Untrusted provider/browser DTOs are converted
 * into these shapes only after authentication and identity resolution.
 */

export const contactIdentitySchema = z.object({
  clientId: z.string().min(1),
  normalizedPhone: z.string().optional(),
  publicSessionId: z.string().optional(),
})
export type ContactIdentity = z.infer<typeof contactIdentitySchema>

export const textContentSchema = z.object({
  kind: z.literal('text'),
  text: z.string().min(1).max(4000),
})
export type TextContent = z.infer<typeof textContentSchema>

export const inboundMessageSchema = z.object({
  schemaVersion: z.literal(1),
  tenantId: z.string().min(1),
  channel: channelSchema,
  conversationId: z.string().min(1),
  contact: contactIdentitySchema,
  content: textContentSchema,
  occurredAt: z.string().min(1),
  provider: z.object({
    adapter: z.string().min(1),
    eventId: z.string().min(1),
    messageId: z.string().optional(),
    instanceId: z.string().optional(),
  }),
  idempotencyKey: z.string().min(1),
})
export type InboundMessage = z.infer<typeof inboundMessageSchema>

export const outboundMessageSchema = z.object({
  schemaVersion: z.literal(1),
  tenantId: z.string().min(1),
  channel: channelSchema,
  conversationId: z.string().min(1),
  contact: contactIdentitySchema,
  recipient: z.object({
    normalizedPhone: z.string().optional(),
    publicSessionId: z.string().optional(),
  }),
  content: textContentSchema,
  createdAt: z.string().min(1),
  provider: z.object({
    adapter: z.string().min(1),
    correlationId: z.string().min(1),
    messageId: z.string().optional(),
    instanceId: z.string().optional(),
  }),
  idempotencyKey: z.string().min(1),
  causationMessageId: z.string().optional(),
})
export type OutboundMessage = z.infer<typeof outboundMessageSchema>
