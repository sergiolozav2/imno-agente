import type { LeadStatus, Result, SafeError } from '@imno/contracts'
import type { TenantContext } from './tenant-context'
import type {
  BuyerClient,
  Conversation,
  Message,
  Property,
  PropertyFact,
} from './entities'

/**
 * Framework-neutral ports. Adapters (Payload, Evolution, the configured model,
 * FFmpeg) implement these; use-case packages depend only on these interfaces.
 * Every tenant-owned method takes a server-derived TenantContext.
 */

export interface PropertySearchQuery {
  /** Free-text buyer criteria, already extracted from the message. */
  text?: string
  /** Explicit listing reference (e.g. "101 Palm Ave"). */
  reference?: string
  minBedrooms?: number
  maxPrice?: number
  zone?: string
  limit?: number
}

export interface ConversationContext {
  conversation: Conversation
  client: BuyerClient
  recentMessages: Message[]
}

export interface NewMessage {
  conversationId: string
  direction: Message['direction']
  author: Message['author']
  text: string
  idempotencyKey: string
  providerMessageId?: string | null
  causationMessageId?: string | null
}

/**
 * Lead temperature ranking. Interest is monotonic for the MVP: an automated
 * update may promote a buyer (Cold -> Warm -> Hot) but never demote one, so a
 * later low-signal message cannot erase a qualified lead. Human edits through
 * the CRM are unaffected.
 */
export const leadStatusRank: Record<LeadStatus, number> = { Cold: 0, Warm: 1, Hot: 2 }

export interface LeadStatusUpdate {
  clientId: string
  status: LeadStatus
  reason: string
}

/** Tenant-scoped data access. Adapters add the tenant predicate internally. */
export interface DataGateway {
  getConversation(context: TenantContext, conversationId: string): Promise<Result<Conversation, SafeError>>
  getClient(context: TenantContext, clientId: string): Promise<Result<BuyerClient, SafeError>>
  loadConversationContext(
    context: TenantContext,
    conversationId: string,
  ): Promise<Result<ConversationContext, SafeError>>
  searchProperties(
    context: TenantContext,
    query: PropertySearchQuery,
  ): Promise<Result<PropertyFact[], SafeError>>
  getProperty(context: TenantContext, propertyId: string): Promise<Result<Property, SafeError>>
  appendMessage(context: TenantContext, message: NewMessage): Promise<Result<Message, SafeError>>
  updateLeadStatus(context: TenantContext, update: LeadStatusUpdate): Promise<Result<void, SafeError>>
}

export interface OutboundChannelMessage {
  conversationId: string
  text: string
  correlationId: string
  /** Channel delivery address resolved from the persisted conversation. */
  recipient: { normalizedPhone?: string; publicSessionId?: string }
}

export interface DeliveryResult {
  state: 'sent' | 'failed' | 'unknown'
  providerMessageId?: string
  safeError?: string
}

/** Delivery adapter selected from the persisted conversation channel. */
export interface ChannelPort {
  send(context: TenantContext, message: OutboundChannelMessage): Promise<DeliveryResult>
}

export interface StructuredGenerationRequest<T> {
  system: string
  user: string
  /** JSON-schema-like validator applied to the model's structured output. */
  validate: (raw: unknown) => Result<T, SafeError>
  temperature?: number
  maxTokens?: number
}

export interface ModelResult<T> {
  value: T
  usage?: { promptTokens?: number; completionTokens?: number }
}

/** The canonical low-level model transport. The configured adapter implements it. */
export interface StructuredModelTransport {
  generateStructured<T>(
    request: StructuredGenerationRequest<T>,
  ): Promise<Result<ModelResult<T>, SafeError>>
}
