import type { Payload } from 'payload'
import {
  type EvolutionWebhookInput,
  ErrorCode,
  evolutionWebhookInputSchema,
  httpForError,
} from '@imno/contracts'
import {
  decideWebhook,
  isSameWhatsappNumber,
  normalizePhone,
  stripWhatsAppSuffix,
} from '@imno/domain'
import { normalizeEvolutionWebhookPayload } from '@imno/integration-evolution'
import { loadEvolutionConfig } from '@imno/runtime-config'
import { getPayloadClient } from '@/lib/payload-client'
import { resolveTenantFromInstance } from '@/lib/instance-tenant'
import { resolveOperatorFromPhone } from '@/lib/operator-identity'
import { toId } from '@/lib/payload-ids'
import { processInbound } from '@/lib/process-inbound'
import { processOperatorInbound } from '@/lib/process-operator-inbound'
import { readSystemWhatsapp } from '@/lib/system-whatsapp'

/**
 * Evolution (WhatsApp) ingress.
 *
 * The security-critical ordering lives in the pure `decideWebhook`:
 * auth -> accepted event type -> outbound echo -> dedup key. Only an
 * authenticated, accepted, non-echo event reaches persistence, and the
 * webhook-receipt unique key guarantees exactly one message and one work item
 * per provider event even under Evolution's retries.
 *
 * Past that gate the event takes one of two paths, depending on which line it
 * arrived on: a buyer writing to an agency, or an agency operator writing to
 * the platform's own line.
 */

function jsonError(code: ErrorCode, status?: number): Response {
  return Response.json({ error: { code } }, { status: status ?? httpForError[code] })
}

function safeJson(raw: string): unknown {
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

/** Find-or-create the tenant-scoped buyer keyed by normalized phone. */
async function upsertBuyer(
  payload: Payload,
  tenantId: string,
  normalizedPhone: string,
): Promise<string> {
  const found = await payload.find({
    collection: 'buyer-clients',
    where: {
      and: [{ tenant: { equals: tenantId } }, { normalizedPhone: { equals: normalizedPhone } }],
    },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  if (found.docs[0]) return String(found.docs[0].id)

  const created = await payload.create({
    collection: 'buyer-clients',
    overrideAccess: true,
    data: { tenant: toId(tenantId), name: normalizedPhone, normalizedPhone, leadStatus: 'Cold' },
  })
  return String(created.id)
}

/** Find-or-create the tenant-scoped WhatsApp conversation keyed by the phone thread. */
async function upsertConversation(
  payload: Payload,
  tenantId: string,
  clientId: string,
  threadId: string,
): Promise<string> {
  const found = await payload.find({
    collection: 'conversations',
    where: {
      and: [
        { tenant: { equals: tenantId } },
        { channel: { equals: 'whatsapp' } },
        { channelThreadId: { equals: threadId } },
      ],
    },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  if (found.docs[0]) return String(found.docs[0].id)

  const created = await payload.create({
    collection: 'conversations',
    overrideAccess: true,
    data: {
      tenant: toId(tenantId),
      client: toId(clientId),
      channel: 'whatsapp',
      channelThreadId: threadId,
    },
  })
  return String(created.id)
}

/**
 * Store a tenant line's own number the first time we see it. Best-effort: the
 * buyer's message matters more than the bookkeeping, so a failure is swallowed.
 */
async function rememberInstanceNumber(
  payload: Payload,
  instanceId: string,
  connectedAccount: string,
  countryCode: string,
): Promise<void> {
  const normalized = normalizePhone(stripWhatsAppSuffix(connectedAccount), countryCode)
  if (!normalized.ok) return
  await payload
    .update({
      collection: 'whatsapp-instances',
      id: instanceId,
      overrideAccess: true,
      data: { connectedNumber: normalized.value.e164 },
    })
    .catch(() => null)
}

/**
 * Inbound on the platform's own line. The instance identifies no tenant here —
 * it is ours — so identity comes from the sender instead. An unrecognised
 * number is acknowledged and dropped: we cannot scope an agent turn without
 * knowing whose data it may touch.
 */
async function operatorInbound(
  payload: Payload,
  input: EvolutionWebhookInput,
  eventKey: string,
  instanceName: string,
): Promise<Response> {
  const text = (input.text ?? '').trim()
  if (text.length === 0) {
    return Response.json({ acknowledged: true, ignored: 'empty-text' }, { status: 200 })
  }

  // A provider JID is already a full international number, so the country
  // context below is only a formality for this parse.
  const phoneResult = normalizePhone(stripWhatsAppSuffix(input.sender), 'ES')
  if (!phoneResult.ok) return jsonError(ErrorCode.InvalidPhone)
  const operatorPhone = phoneResult.value.e164

  const operator = await resolveOperatorFromPhone(payload, operatorPhone)
  if (!operator) {
    return Response.json({ acknowledged: true, ignored: 'unknown-operator' }, { status: 200 })
  }

  const outcome = await processOperatorInbound(payload, {
    operator,
    eventKey,
    operatorText: text,
    operatorPhone,
    instanceName,
  })

  if (outcome.state === 'deduplicated') {
    return Response.json({ acknowledged: true, deduplicated: true }, { status: 200 })
  }
  return Response.json({ acknowledged: true }, { status: 200 })
}

export async function POST(req: Request): Promise<Response> {
  try {
    const raw = await req.text()
    const parsed = evolutionWebhookInputSchema.safeParse(
      normalizeEvolutionWebhookPayload(safeJson(raw)),
    )
    if (!parsed.success) return jsonError(ErrorCode.ValidationFailed)
    const input = parsed.data

    const configResult = loadEvolutionConfig()
    if (!configResult.ok) return jsonError(ErrorCode.ConfigInvalid)

    // Evolution forwards the header registered with the instance; some setups
    // only echo the instance api key, so either is accepted as the shared secret.
    const providedSecret = req.headers.get('x-webhook-secret') ?? req.headers.get('apikey')
    const decision = decideWebhook({
      input,
      providedSecret,
      expectedSecret: configResult.value.webhookSecret,
    })

    if (decision.action === 'reject-unauthorized') {
      return jsonError(ErrorCode.InternalAuthInvalid)
    }
    if (decision.action === 'acknowledge-ignored') {
      return Response.json({ acknowledged: true, ignored: decision.reason }, { status: 200 })
    }

    const payload = await getPayloadClient()
    const systemLine = await readSystemWhatsapp(payload)

    // Loop breaker. An agency operator writes to us from the same phone that
    // owns their bot line, so our reply lands back on their instance as an
    // ordinary inbound message — `fromMe` is false there, and the buyer agent
    // would answer it, which we would answer in turn, forever. Nothing the
    // platform line says is ever a buyer message.
    if (isSameWhatsappNumber(input.sender, systemLine.connectedNumber)) {
      return Response.json({ acknowledged: true, ignored: 'system-line' }, { status: 200 })
    }

    if (systemLine.instanceName && input.instanceName === systemLine.instanceName) {
      return operatorInbound(payload, input, decision.eventKey, systemLine.instanceName)
    }

    const resolved = await resolveTenantFromInstance(payload, input.instanceName)
    // Non-disclosing 404 when the instance is not registered to any tenant.
    if (!resolved.ok) return jsonError(ErrorCode.ResourceNotFound)
    const { context, instanceId, countryCode } = resolved.value

    // Evolution names the receiving account on every event, so the first buyer
    // message teaches us a tenant line's own number — which is what lets us
    // recognise that agency later when they write to the platform line.
    if (!resolved.value.connectedNumber && input.connectedAccount) {
      await rememberInstanceNumber(payload, instanceId, input.connectedAccount, countryCode)
    }

    const phoneResult = normalizePhone(stripWhatsAppSuffix(input.sender), countryCode)
    if (!phoneResult.ok) return jsonError(ErrorCode.InvalidPhone)
    const normalizedPhone = phoneResult.value.e164

    const clientId = await upsertBuyer(payload, context.tenantId, normalizedPhone)
    const conversationId = await upsertConversation(
      payload,
      context.tenantId,
      clientId,
      normalizedPhone,
    )

    const eventKey = decision.eventKey

    // Dedup gate: the unique (instance, providerEventKey) index makes a replayed
    // event fail here, so we acknowledge without any further writes.
    try {
      await payload.create({
        collection: 'webhook-receipts',
        overrideAccess: true,
        data: {
          tenant: toId(context.tenantId),
          instance: toId(instanceId),
          providerEventKey: eventKey,
          acceptedEventType: input.eventType,
          receivedAt: new Date().toISOString(),
        },
      })
    } catch {
      return Response.json({ acknowledged: true, deduplicated: true }, { status: 200 })
    }

    // First observation of this event: exactly one inbound message and one work item.
    const buyerText = input.text ?? ''
    let inboundMessageId: string
    try {
      const created = await payload.create({
        collection: 'messages',
        overrideAccess: true,
        data: {
          tenant: toId(context.tenantId),
          conversation: toId(conversationId),
          direction: 'inbound',
          author: 'buyer',
          text: buyerText,
          ...(input.messageId ? { providerMessageId: input.messageId } : {}),
          idempotencyKey: eventKey,
          processingState: 'pending',
        },
      })
      inboundMessageId = String(created.id)

      await payload.create({
        collection: 'message-processing',
        overrideAccess: true,
        data: {
          tenant: toId(context.tenantId),
          inboundMessage: toId(inboundMessageId),
          state: 'pending',
        },
      })
    } catch {
      return Response.json({ acknowledged: true, deduplicated: true }, { status: 200 })
    }

    // Best-effort synchronous reply. The receipt, message, and work item are
    // already durable, so a failure here is retryable without data loss.
    if (buyerText.trim().length > 0) {
      try {
        await processInbound(payload, {
          context,
          conversationId,
          clientId,
          inboundMessageId,
          eventKey,
          buyerText,
          recipientPhone: normalizedPhone,
          instanceName: input.instanceName,
        })
      } catch {
        // Ingress still acknowledges: the buyer's message is stored either way.
      }
    }

    return Response.json({ acknowledged: true }, { status: 200 })
  } catch {
    return jsonError(ErrorCode.ValidationFailed, 500)
  }
}
