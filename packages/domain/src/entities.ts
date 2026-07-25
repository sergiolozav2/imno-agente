import type {
  Channel,
  DeliveryState,
  LeadStatus,
  MediaKind,
  MembershipRole,
  MessageAuthor,
  MessageDirection,
  PricingUnit,
  ProcessingState,
} from '@imno/contracts'

/**
 * Framework-neutral entity shapes required by Modules B–G. These describe the
 * data the domain reasons about; persistence mapping lives in adapters.
 */

export interface AgencyUser {
  id: string
  email: string
  displayName: string
}

export interface Tenant {
  id: string
  slug: string
  name: string
  /** ISO 3166-1 alpha-2 country code used for phone normalization. */
  countryCode: string
  publicChatKey: string
  allowedOrigins: string[]
}

export interface Membership {
  id: string
  userId: string
  tenantId: string
  role: MembershipRole
}

export interface Property {
  id: string
  tenantId: string
  reference: string
  title: string
  description: string
  price: number
  currency: string
  zone: string
  pricingUnit: PricingUnit
  status: 'available' | 'reserved' | 'sold'
  imageIds: string[]
  mainImageId: string | null
  model3dId: string | null
  bedrooms?: number
  bathrooms?: number
  areaSqm?: number
}

export interface BuyerClient {
  id: string
  tenantId: string
  name: string
  normalizedPhone: string | null
  email: string | null
  leadStatus: LeadStatus
}

export interface MediaAsset {
  id: string
  tenantId: string
  kind: MediaKind
  mimeType: string
  r2Key: string
  size: number
  originalName: string
  processingState?: ProcessingState
}

export interface ZonalPrice {
  id: string
  tenantId: string
  /** Normalized (lowercased, trimmed) zone key. */
  zone: string
  pricingUnit: PricingUnit
  amount: number
  currency: string
}

export interface Conversation {
  id: string
  tenantId: string
  clientId: string
  channel: Channel
  channelThreadId: string
  botPaused: boolean
}

export interface Message {
  id: string
  tenantId: string
  conversationId: string
  direction: MessageDirection
  author: MessageAuthor
  text: string
  providerMessageId: string | null
  idempotencyKey: string
  processingState: ProcessingState | null
  deliveryState: DeliveryState | null
  createdAt: string
}

export interface WhatsAppInstance {
  id: string
  tenantId: string
  instanceName: string
  externalInstanceId: string | null
  connectionState: 'open' | 'connecting' | 'close'
  webhookConfigured: boolean
}

export interface WebhookReceipt {
  id: string
  tenantId: string
  instanceId: string
  providerEventKey: string
  acceptedEventType: string
  receivedAt: string
}

export interface MessageProcessing {
  id: string
  tenantId: string
  inboundMessageId: string
  state: ProcessingState
  attempts: number
  safeError: string | null
  createdAt: string
  updatedAt: string
}

/** Bounded, safe listing facts handed to the model for grounding. */
export interface PropertyFact {
  id: string
  reference: string
  title: string
  zone: string
  price: number
  currency: string
  bedrooms?: number
  bathrooms?: number
  areaSqm?: number
  status: string
  summary: string
}
