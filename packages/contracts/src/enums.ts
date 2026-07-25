import { z } from 'zod'

/** Channels that share the provider-neutral message contract. */
export const channelSchema = z.enum(['whatsapp', 'web-chat'])
export type Channel = z.infer<typeof channelSchema>

export const leadStatusSchema = z.enum(['Cold', 'Warm', 'Hot'])
export type LeadStatus = z.infer<typeof leadStatusSchema>

export const messageDirectionSchema = z.enum(['inbound', 'outbound'])
export type MessageDirection = z.infer<typeof messageDirectionSchema>

export const messageAuthorSchema = z.enum(['buyer', 'ai', 'human', 'system'])
export type MessageAuthor = z.infer<typeof messageAuthorSchema>

/**
 * Persisted processing state for one inbound work item. Simple states only —
 * no production lease/queue machinery for the MVP.
 * `skipped` represents bot-paused suppression (no AI output).
 */
export const processingStateSchema = z.enum([
  'pending',
  'processing',
  'completed',
  'failed',
  'skipped',
])
export type ProcessingState = z.infer<typeof processingStateSchema>

/** Outbound delivery state. `unknown` = ambiguous outcome, no auto-resend. */
export const deliveryStateSchema = z.enum(['pending', 'sent', 'failed', 'unknown'])
export type DeliveryState = z.infer<typeof deliveryStateSchema>

export const membershipRoleSchema = z.enum(['owner', 'member'])
export type MembershipRole = z.infer<typeof membershipRoleSchema>

export const mediaKindSchema = z.enum(['image', 'model-3d', 'music', 'video'])
export type MediaKind = z.infer<typeof mediaKindSchema>

export const pricingUnitSchema = z.enum(['per_sqm', 'total', 'per_month'])
export type PricingUnit = z.infer<typeof pricingUnitSchema>
