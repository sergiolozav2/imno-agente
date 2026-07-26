import { randomUUID } from 'node:crypto'
import type { Payload, Where } from 'payload'
import { type Result, type SafeError, ErrorCode, err, ok } from '@imno/contracts'
import { leadStatusRank } from '@imno/domain'
import { createEvolutionClient, toEvolutionRecipient } from '@imno/integration-evolution'
import { loadEvolutionConfig } from '@imno/runtime-config'
import { findInstanceNameForTenant } from './instance-tenant'
import { asRecord, toId } from './payload-ids'
import { connectedSystemInstanceName } from './system-whatsapp'
import {
  asIsoString,
  boundedLimit,
  nullableNumber,
  nullableString,
  objectParam,
  optionalEnum,
  optionalNumber,
  optionalText,
  relationshipId,
  requiredText,
  type Params,
} from './data-params'

/**
 * The operation catalogue behind the internal data bridge.
 *
 * The agent runtime has no database credentials: it names an operation and the
 * API decides what that means. Two invariants hold for every operation here.
 * First, the tenant predicate is added server-side from the authenticated
 * caller's tenant id, so the model cannot address another agency's data even by
 * guessing ids — foreign rows read back as NOT_FOUND. Second, projections are
 * explicit, so new database columns are never silently exposed to a prompt.
 */

const LEAD_STATUSES = ['Cold', 'Warm', 'Hot'] as const
const PROPERTY_STATUSES = ['available', 'reserved', 'sold'] as const
const PRICING_UNITS = ['per_sqm', 'total', 'per_month'] as const
const CHANNELS = ['whatsapp', 'web-chat'] as const
const DIRECTIONS = ['inbound', 'outbound'] as const

type LeadStatus = (typeof LEAD_STATUSES)[number]

export interface OperationContext {
  payload: Payload
  tenantId: string
  /**
   * Origin of the request that opened the bridge, used to absolutise media URLs
   * when `API_URL` is not configured in this process.
   */
  origin?: string
}

type OperationHandler = (
  context: OperationContext,
  params: Params,
) => Promise<Result<unknown, SafeError>>

const notFound: SafeError = { code: ErrorCode.ResourceNotFound }

function validation(message: string): SafeError {
  return { code: ErrorCode.ValidationFailed, message }
}

/** Read one tenant-owned document, or NOT_FOUND if it belongs to anyone else. */
async function findOwned(
  context: OperationContext,
  collection: 'properties' | 'buyer-clients' | 'conversations',
  id: string,
  depth = 0,
): Promise<Result<Record<string, unknown>, SafeError>> {
  const doc = await context.payload
    .findByID({ collection, id, depth, overrideAccess: true })
    .catch(() => null)
  if (!doc) return err(notFound)
  if (relationshipId((doc as { tenant?: unknown }).tenant) !== context.tenantId) {
    return err(notFound)
  }
  return ok(asRecord(doc))
}

function tenantWhere(context: OperationContext, extra: Where[] = []): Where {
  return { and: [{ tenant: { equals: context.tenantId } }, ...extra] }
}

// -----------------------------------------------------------------------------
// Projections
// -----------------------------------------------------------------------------

function toProperty(
  context: OperationContext,
  doc: Record<string, unknown>,
): Record<string, unknown> {
  return {
    id: String(doc.id),
    reference: String(doc.reference ?? ''),
    title: String(doc.title ?? ''),
    description: String(doc.description ?? ''),
    zone: String(doc.zone ?? ''),
    price: nullableNumber(doc.price),
    currency: String(doc.currency ?? ''),
    pricingUnit: String(doc.pricingUnit ?? ''),
    status: String(doc.status ?? ''),
    bedrooms: nullableNumber(doc.bedrooms),
    bathrooms: nullableNumber(doc.bathrooms),
    areaSqm: nullableNumber(doc.areaSqm),
    // Only populated when the caller read at depth >= 1. Search results stay
    // lean: a prompt does not need twenty URLs to pick a listing.
    imageUrls: mediaUrlList(context, doc.images),
    mainImageUrl: mediaUrl(context, doc.mainImage),
    videoUrl: mediaUrl(context, doc.video),
  }
}

/**
 * Payload stores upload URLs host-relative. Consumers of these URLs are all off
 * this machine — the agent container downloads property photos, WhatsApp fetches
 * the finished reel — so a relative path reaches them as an unfetchable string.
 *
 * `API_URL` is the explicit answer, but the deployed Worker does not receive it
 * (it is not among the vars pushed to Cloudflare), which left every URL crossing
 * the bridge relative. The origin of the calling request is the same host, so it
 * is used as the fallback and no configuration is required for this to work.
 */
export function absoluteMediaUrl(context: Pick<OperationContext, 'origin'>, url: string): string {
  if (/^https?:\/\//.test(url)) return url
  const base = (process.env.API_URL ?? context.origin ?? '').replace(/\/$/, '')
  return `${base}${url.startsWith('/') ? url : `/${url}`}`
}

/** A URL only when the relation was populated; ids alone carry no URL. */
function mediaUrl(context: OperationContext, value: unknown): string | null {
  if (!value || typeof value !== 'object') return null
  const url = (value as { url?: unknown }).url
  return typeof url === 'string' && url.length > 0 ? absoluteMediaUrl(context, url) : null
}

function mediaUrlList(context: OperationContext, value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .map((entry) => mediaUrl(context, entry))
    .filter((url): url is string => url !== null)
}

function toClient(doc: Record<string, unknown>): Record<string, unknown> {
  return {
    id: String(doc.id),
    name: String(doc.name ?? ''),
    normalizedPhone: nullableString(doc.normalizedPhone),
    email: nullableString(doc.email),
    leadStatus: String(doc.leadStatus ?? 'Cold'),
  }
}

function toMessage(doc: Record<string, unknown>): Record<string, unknown> {
  return {
    id: String(doc.id),
    conversationId: relationshipId(doc.conversation),
    direction: String(doc.direction ?? ''),
    author: String(doc.author ?? ''),
    text: String(doc.text ?? ''),
    createdAt: asIsoString(doc.createdAt),
  }
}

// -----------------------------------------------------------------------------
// Properties
// -----------------------------------------------------------------------------

const propertiesSearch: OperationHandler = async (context, params) => {
  const filters: Where[] = []

  const text = optionalText(params, 'text')
  if (text) {
    filters.push({
      or: [
        { reference: { like: text } },
        { title: { like: text } },
        { zone: { like: text } },
        { description: { like: text } },
      ],
    })
  }

  const zone = optionalText(params, 'zone')
  if (zone) filters.push({ zone: { like: zone } })

  const status = optionalEnum(params, 'status', PROPERTY_STATUSES)
  if (status) filters.push({ status: { equals: status } })

  const minBedrooms = optionalNumber(params, 'minBedrooms')
  if (minBedrooms !== undefined) filters.push({ bedrooms: { greater_than_equal: minBedrooms } })

  const minPrice = optionalNumber(params, 'minPrice')
  if (minPrice !== undefined) filters.push({ price: { greater_than_equal: minPrice } })

  const maxPrice = optionalNumber(params, 'maxPrice')
  if (maxPrice !== undefined) filters.push({ price: { less_than_equal: maxPrice } })

  const result = await context.payload.find({
    collection: 'properties',
    where: tenantWhere(context, filters),
    limit: boundedLimit(params, 10, 25),
    depth: 0,
    overrideAccess: true,
    sort: '-updatedAt',
  })

  return ok({ properties: result.docs.map((doc) => toProperty(context, asRecord(doc))) })
}

const propertiesGet: OperationHandler = async (context, params) => {
  const propertyId = requiredText(params, 'propertyId')
  if (!propertyId) return err(validation('propertyId is required.'))

  // Depth 1 so image and video URLs come back populated — the video renderer
  // needs the photo URLs, and every caller benefits from knowing a reel exists.
  const found = await findOwned(context, 'properties', propertyId, 1)
  if (!found.ok) return err(found.error)
  return ok({ property: toProperty(context, found.value) })
}

const MAX_VIDEO_BYTES = 24 * 1024 * 1024

/**
 * Store a rendered reel and hang it off the listing.
 *
 * The agent has no R2 credentials and no multipart channel, so the encoded file
 * arrives base64 in the JSON body. That caps the practical size, which is fine:
 * the renderer targets a few megabytes precisely so WhatsApp will inline it.
 * Regeneration replaces the pointer and leaves the old asset orphaned rather
 * than deleting bytes a buyer may still have a link to.
 */
const propertiesAttachVideo: OperationHandler = async (context, params) => {
  const propertyId = requiredText(params, 'propertyId')
  if (!propertyId) return err(validation('propertyId is required.'))

  const dataBase64 = requiredText(params, 'dataBase64')
  if (!dataBase64) return err(validation('dataBase64 is required.'))

  const found = await findOwned(context, 'properties', propertyId)
  if (!found.ok) return err(found.error)

  let data: Buffer
  try {
    data = Buffer.from(dataBase64, 'base64')
  } catch {
    return err(validation('dataBase64 was not valid base64.'))
  }
  if (data.byteLength === 0) return err(validation('The video payload was empty.'))
  if (data.byteLength > MAX_VIDEO_BYTES) {
    return err(validation('The video exceeds the 24 MB upload limit.'))
  }

  const reference = String(found.value.reference ?? propertyId).replace(/[^a-zA-Z0-9._-]/g, '-')
  const filename = optionalText(params, 'filename') ?? `reel-${reference}-${Date.now()}.mp4`

  const asset = await context.payload.create({
    collection: 'media-assets',
    overrideAccess: true,
    data: { tenant: toId(context.tenantId), kind: 'video' },
    file: {
      data,
      mimetype: 'video/mp4',
      name: filename,
      size: data.byteLength,
    },
  })

  await context.payload.update({
    collection: 'properties',
    id: propertyId,
    overrideAccess: true,
    data: { video: asset.id },
  })

  const url = mediaUrl(context, asRecord(asset))
  if (!url) {
    return err({ code: ErrorCode.RenderFailure, message: 'The upload returned no URL.' })
  }

  return ok({ propertyId, mediaId: String(asset.id), url, sizeBytes: data.byteLength })
}

// -----------------------------------------------------------------------------
// Tenant branding
// -----------------------------------------------------------------------------

/**
 * The agency identity burned into video corners. Read-only and deliberately
 * narrow — the renderer needs a name and a number to display, nothing else.
 */
const tenantBranding: OperationHandler = async (context) => {
  const tenant = await context.payload
    .findByID({ collection: 'tenants', id: context.tenantId, depth: 0, overrideAccess: true })
    .catch(() => null)
  if (!tenant) return err(notFound)

  const doc = asRecord(tenant)
  const instanceName = await findInstanceNameForTenant(context.payload, context.tenantId)
  const phone = instanceName ? await connectedNumberFor(context, instanceName) : null

  return ok({
    businessName: nullableString(doc.agentBusinessName) ?? String(doc.name ?? ''),
    assistantName: nullableString(doc.agentAssistantName),
    phone,
  })
}

async function connectedNumberFor(
  context: OperationContext,
  instanceName: string,
): Promise<string | null> {
  const found = await context.payload
    .find({
      collection: 'whatsapp-instances',
      where: { instanceName: { equals: instanceName } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    .catch(() => null)
  const doc = found?.docs[0]
  return doc ? nullableString(asRecord(doc).connectedNumber) : null
}

const propertiesUpdate: OperationHandler = async (context, params) => {
  const propertyId = requiredText(params, 'propertyId')
  if (!propertyId) return err(validation('propertyId is required.'))

  const found = await findOwned(context, 'properties', propertyId)
  if (!found.ok) return err(found.error)

  const patch = objectParam(params, 'patch')
  const data: Record<string, unknown> = {}

  for (const key of ['title', 'description', 'zone', 'currency'] as const) {
    const value = optionalText(patch, key)
    if (value !== undefined) data[key] = value
  }
  for (const key of ['price', 'bedrooms', 'bathrooms', 'areaSqm'] as const) {
    const value = optionalNumber(patch, key)
    if (value !== undefined) data[key] = value
  }
  const status = optionalEnum(patch, 'status', PROPERTY_STATUSES)
  if (status) data.status = status
  const pricingUnit = optionalEnum(patch, 'pricingUnit', PRICING_UNITS)
  if (pricingUnit) data.pricingUnit = pricingUnit

  if (Object.keys(data).length === 0) {
    return err(validation('The patch contained no supported fields.'))
  }

  const updated = await context.payload.update({
    collection: 'properties',
    id: propertyId,
    overrideAccess: true,
    data,
  })

  return ok({
    property: toProperty(context, asRecord(updated)),
    updatedFields: Object.keys(data),
  })
}

// -----------------------------------------------------------------------------
// Buyer clients
// -----------------------------------------------------------------------------

const clientsSearch: OperationHandler = async (context, params) => {
  const filters: Where[] = []

  const text = optionalText(params, 'text')
  if (text) {
    filters.push({
      or: [
        { name: { like: text } },
        { email: { like: text } },
        { normalizedPhone: { like: text } },
      ],
    })
  }
  const leadStatus = optionalEnum(params, 'leadStatus', LEAD_STATUSES)
  if (leadStatus) filters.push({ leadStatus: { equals: leadStatus } })

  const result = await context.payload.find({
    collection: 'buyer-clients',
    where: tenantWhere(context, filters),
    limit: boundedLimit(params, 10, 25),
    depth: 0,
    overrideAccess: true,
    sort: '-updatedAt',
  })

  return ok({ clients: result.docs.map((doc) => toClient(asRecord(doc))) })
}

const clientsGet: OperationHandler = async (context, params) => {
  const clientId = requiredText(params, 'clientId')
  if (!clientId) return err(validation('clientId is required.'))

  const found = await findOwned(context, 'buyer-clients', clientId)
  if (!found.ok) return err(found.error)
  return ok({ client: toClient(found.value) })
}

const clientsUpdate: OperationHandler = async (context, params) => {
  const clientId = requiredText(params, 'clientId')
  if (!clientId) return err(validation('clientId is required.'))

  const found = await findOwned(context, 'buyer-clients', clientId)
  if (!found.ok) return err(found.error)

  const patch = objectParam(params, 'patch')
  const data: Record<string, unknown> = {}
  for (const key of ['name', 'email'] as const) {
    const value = optionalText(patch, key)
    if (value !== undefined) data[key] = value
  }
  const leadStatus = optionalEnum(patch, 'leadStatus', LEAD_STATUSES)
  if (leadStatus) data.leadStatus = leadStatus

  if (Object.keys(data).length === 0) {
    return err(validation('The patch contained no supported fields.'))
  }

  const updated = await context.payload.update({
    collection: 'buyer-clients',
    id: clientId,
    overrideAccess: true,
    data,
  })

  return ok({
    client: toClient(asRecord(updated)),
    updatedFields: Object.keys(data),
  })
}

/**
 * Lead temperature is monotonic for automated writers: a model may promote a
 * buyer but never cool one down, so a later low-signal message cannot erase a
 * qualified lead. A rejected demotion is reported as `changed: false` rather
 * than an error, which is what the calling tool wants to tell the user.
 */
const clientsSetLeadStatus: OperationHandler = async (context, params) => {
  const clientId = requiredText(params, 'clientId')
  if (!clientId) return err(validation('clientId is required.'))

  const status = optionalEnum(params, 'status', LEAD_STATUSES)
  if (!status) return err(validation('status must be Cold, Warm, or Hot.'))

  const found = await findOwned(context, 'buyer-clients', clientId)
  if (!found.ok) return err(found.error)

  const previous = String(found.value.leadStatus ?? 'Cold') as LeadStatus
  const previousRank = leadStatusRank[previous] ?? 0
  if (leadStatusRank[status] <= previousRank) {
    return ok({
      clientId,
      leadStatus: previous,
      previousLeadStatus: previous,
      changed: false,
    })
  }

  await context.payload.update({
    collection: 'buyer-clients',
    id: clientId,
    overrideAccess: true,
    data: { leadStatus: status },
  })

  return ok({ clientId, leadStatus: status, previousLeadStatus: previous, changed: true })
}

// -----------------------------------------------------------------------------
// Conversations and messages
// -----------------------------------------------------------------------------

const conversationsList: OperationHandler = async (context, params) => {
  const filters: Where[] = []

  const clientId = optionalText(params, 'clientId')
  if (clientId) filters.push({ client: { equals: clientId } })

  const channel = optionalEnum(params, 'channel', CHANNELS)
  if (channel) filters.push({ channel: { equals: channel } })

  const result = await context.payload.find({
    collection: 'conversations',
    where: tenantWhere(context, filters),
    limit: boundedLimit(params, 10, 25),
    depth: 0,
    overrideAccess: true,
    sort: '-updatedAt',
  })

  return ok({
    conversations: result.docs.map((raw) => {
      const doc = asRecord(raw)
      return {
        id: String(doc.id),
        clientId: relationshipId(doc.client),
        channel: String(doc.channel ?? ''),
        channelThreadId: String(doc.channelThreadId ?? ''),
        botPaused: doc.botPaused === true,
        updatedAt: asIsoString(doc.updatedAt),
      }
    }),
  })
}

const conversationsMessages: OperationHandler = async (context, params) => {
  const conversationId = requiredText(params, 'conversationId')
  if (!conversationId) return err(validation('conversationId is required.'))

  // Ownership is checked on the conversation before any message is read.
  const owned = await findOwned(context, 'conversations', conversationId)
  if (!owned.ok) return err(owned.error)

  const result = await context.payload.find({
    collection: 'messages',
    where: tenantWhere(context, [{ conversation: { equals: conversationId } }]),
    limit: boundedLimit(params, 15, 25),
    depth: 0,
    overrideAccess: true,
    sort: '-createdAt',
  })

  // Query newest-first for the limit, hand back chronological for reading.
  const messages = result.docs.map((doc) => toMessage(asRecord(doc))).reverse()

  return ok({ conversationId, messages })
}

const messagesSearch: OperationHandler = async (context, params) => {
  const filters: Where[] = []

  const text = optionalText(params, 'text')
  if (text) filters.push({ text: { like: text } })

  const conversationId = optionalText(params, 'conversationId')
  if (conversationId) {
    const owned = await findOwned(context, 'conversations', conversationId)
    if (!owned.ok) return err(owned.error)
    filters.push({ conversation: { equals: conversationId } })
  }

  const direction = optionalEnum(params, 'direction', DIRECTIONS)
  if (direction) filters.push({ direction: { equals: direction } })

  const result = await context.payload.find({
    collection: 'messages',
    where: tenantWhere(context, filters),
    limit: boundedLimit(params, 15, 25),
    depth: 0,
    overrideAccess: true,
    sort: '-createdAt',
  })

  return ok({ messages: result.docs.map((doc) => toMessage(asRecord(doc))) })
}

// -----------------------------------------------------------------------------
// Outbound WhatsApp
// -----------------------------------------------------------------------------

/**
 * Operator-initiated send. The recipient is always resolved from a persisted,
 * tenant-owned client — the model supplies an id, never a phone number, so it
 * cannot dial an arbitrary line. The message is recorded before delivery so the
 * CRM never shows a reply the agency did not send.
 */
const whatsappSend: OperationHandler = async (context, params) => {
  const clientId = requiredText(params, 'clientId')
  if (!clientId) return err(validation('clientId is required.'))

  const text = requiredText(params, 'text')
  if (!text) return err(validation('text is required.'))

  const found = await findOwned(context, 'buyer-clients', clientId)
  if (!found.ok) return err(found.error)

  const normalizedPhone = nullableString(found.value.normalizedPhone)
  if (!normalizedPhone) {
    return err({ code: ErrorCode.InvalidPhone, message: 'That client has no phone number.' })
  }

  const instanceName = await resolveInstance(context, optionalText(params, 'instanceName'))
  if (!instanceName) {
    return err({
      code: ErrorCode.ChannelFailure,
      message: 'No WhatsApp instance is connected for this agency.',
    })
  }

  const conversationId = await upsertWhatsappConversation(context, clientId, normalizedPhone)

  const message = await context.payload.create({
    collection: 'messages',
    overrideAccess: true,
    data: {
      tenant: toId(context.tenantId),
      conversation: toId(conversationId),
      direction: 'outbound',
      // Operator-approved before sending, so it is attributed to the agency.
      author: 'human',
      text,
      idempotencyKey: `send:${context.tenantId}:${clientId}:${randomUUID()}`,
      deliveryState: 'pending',
    },
  })
  const messageId = String(message.id)

  const config = loadEvolutionConfig()
  if (!config.ok) {
    await markDelivery(context, messageId, 'failed')
    return err({ code: ErrorCode.ConfigInvalid, message: 'WhatsApp is not configured.' })
  }

  const sent = await createEvolutionClient({
    baseUrl: config.value.baseUrl,
    apiKey: config.value.apiKey,
  }).sendText({ instanceName, to: normalizedPhone, text })

  if (!sent.ok) {
    await markDelivery(context, messageId, 'failed')
    return err(sent.error)
  }

  await markDelivery(context, messageId, 'sent', sent.value.providerMessageId)

  return ok({
    delivered: true,
    messageId,
    conversationId,
    instanceName,
    to: toEvolutionRecipient(normalizedPhone),
  })
}

/**
 * Deliver a rendered reel to a buyer.
 *
 * Same recipient rules as `whatsapp.send`: the model names a client id, never a
 * number. The media argument is a URL rather than bytes because Evolution
 * fetches it itself — which is exactly why `media-assets` reads are public.
 * The caption is persisted as the message text so the CRM transcript still
 * reads sensibly for anyone who cannot play the video.
 */
const whatsappSendVideo: OperationHandler = async (context, params) => {
  const clientId = requiredText(params, 'clientId')
  if (!clientId) return err(validation('clientId is required.'))

  const mediaUrlParam = requiredText(params, 'mediaUrl')
  if (!mediaUrlParam) return err(validation('mediaUrl is required.'))

  const caption = optionalText(params, 'caption') ?? ''

  const found = await findOwned(context, 'buyer-clients', clientId)
  if (!found.ok) return err(found.error)

  const normalizedPhone = nullableString(found.value.normalizedPhone)
  if (!normalizedPhone) {
    return err({ code: ErrorCode.InvalidPhone, message: 'That client has no phone number.' })
  }

  const instanceName = await resolveInstance(context, optionalText(params, 'instanceName'))
  if (!instanceName) {
    return err({
      code: ErrorCode.ChannelFailure,
      message: 'No WhatsApp instance is connected for this agency.',
    })
  }

  const conversationId = await upsertWhatsappConversation(context, clientId, normalizedPhone)

  const message = await context.payload.create({
    collection: 'messages',
    overrideAccess: true,
    data: {
      tenant: toId(context.tenantId),
      conversation: toId(conversationId),
      direction: 'outbound',
      author: 'ai',
      text: caption.length > 0 ? caption : '[vídeo de la propiedad]',
      idempotencyKey: `video:${context.tenantId}:${clientId}:${randomUUID()}`,
      deliveryState: 'pending',
    },
  })
  const messageId = String(message.id)

  const config = loadEvolutionConfig()
  if (!config.ok) {
    await markDelivery(context, messageId, 'failed')
    return err({ code: ErrorCode.ConfigInvalid, message: 'WhatsApp is not configured.' })
  }

  const sent = await createEvolutionClient({
    baseUrl: config.value.baseUrl,
    apiKey: config.value.apiKey,
  }).sendMedia({
    instanceName,
    to: normalizedPhone,
    media: mediaUrlParam,
    mediatype: 'video',
    mimetype: 'video/mp4',
    fileName: optionalText(params, 'filename') ?? 'propiedad.mp4',
    ...(caption.length > 0 ? { caption } : {}),
  })

  if (!sent.ok) {
    await markDelivery(context, messageId, 'failed')
    return err(sent.error)
  }

  await markDelivery(context, messageId, 'sent', sent.value.providerMessageId)

  return ok({
    delivered: true,
    messageId,
    conversationId,
    instanceName,
    to: toEvolutionRecipient(normalizedPhone),
  })
}

/**
 * Which line the message leaves from: an explicitly requested instance, then the
 * agency's own, then the platform's system line — which is the one operators
 * reach for when a tenant has not connected WhatsApp yet.
 */
async function resolveInstance(
  context: OperationContext,
  preferred: string | undefined,
): Promise<string | null> {
  if (preferred) return preferred
  const tenantInstance = await findInstanceNameForTenant(context.payload, context.tenantId)
  if (tenantInstance) return tenantInstance
  return connectedSystemInstanceName(context.payload)
}

async function markDelivery(
  context: OperationContext,
  messageId: string,
  state: 'sent' | 'failed',
  providerMessageId?: string,
): Promise<void> {
  await context.payload
    .update({
      collection: 'messages',
      id: messageId,
      overrideAccess: true,
      data: {
        deliveryState: state,
        ...(providerMessageId ? { providerMessageId } : {}),
      },
    })
    .catch(() => null)
}

async function upsertWhatsappConversation(
  context: OperationContext,
  clientId: string,
  normalizedPhone: string,
): Promise<string> {
  const found = await context.payload.find({
    collection: 'conversations',
    where: tenantWhere(context, [
      { channel: { equals: 'whatsapp' } },
      { channelThreadId: { equals: normalizedPhone } },
    ]),
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  if (found.docs[0]) return String(found.docs[0].id)

  const created = await context.payload.create({
    collection: 'conversations',
    overrideAccess: true,
    data: {
      tenant: toId(context.tenantId),
      client: toId(clientId),
      channel: 'whatsapp',
      channelThreadId: normalizedPhone,
    },
  })
  return String(created.id)
}

// -----------------------------------------------------------------------------
// Catalogue
// -----------------------------------------------------------------------------

const operations: Record<string, OperationHandler> = {
  'properties.search': propertiesSearch,
  'properties.get': propertiesGet,
  'properties.update': propertiesUpdate,
  'properties.attachVideo': propertiesAttachVideo,
  'tenant.branding': tenantBranding,
  'clients.search': clientsSearch,
  'clients.get': clientsGet,
  'clients.update': clientsUpdate,
  'clients.setLeadStatus': clientsSetLeadStatus,
  'conversations.list': conversationsList,
  'conversations.messages': conversationsMessages,
  'messages.search': messagesSearch,
  'whatsapp.send': whatsappSend,
  'whatsapp.sendVideo': whatsappSendVideo,
}

/** Run a named operation, or NOT_FOUND when the name is not in the catalogue. */
export async function runDataOperation(
  context: OperationContext,
  operation: string,
  params: Params,
): Promise<Result<unknown, SafeError>> {
  const handler = operations[operation]
  if (!handler) {
    return err({ code: ErrorCode.ResourceNotFound, message: `Unknown operation "${operation}".` })
  }
  return handler(context, params)
}
