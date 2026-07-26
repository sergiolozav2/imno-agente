import type { Payload } from 'payload'
import { createEvolutionClient } from '@imno/integration-evolution'
import { loadEvolutionConfig } from '@imno/runtime-config'
import { requestSystemChat } from './agent-client'
import type { ResolvedOperator } from './operator-identity'
import { toId } from './payload-ids'

/**
 * Inbound on the platform's own WhatsApp line: an agency operator talking to us.
 *
 * Same shape as the buyer path in `process-inbound`, with two differences. The
 * turn goes to the system agent rather than the client agent, because the sender
 * is staff and gets the operations toolset. And there is no webhook receipt to
 * dedup against — receipts are keyed to a `whatsapp-instances` row and the
 * system line has none — so the unique `idempotencyKey` on the inbound message
 * is the gate a replayed event collides on.
 */

export interface OperatorInboundInput {
  operator: ResolvedOperator
  /** Provider event key, used for dedup and to derive the outbound key. */
  eventKey: string
  operatorText: string
  /** The operator's own number, both the thread id and the reply address. */
  operatorPhone: string
  /** The system line to answer from. */
  instanceName: string
}

export type OperatorInboundOutcome =
  | { state: 'completed'; delivered: boolean }
  | { state: 'deduplicated' }
  | { state: 'failed'; reason: string }

/**
 * One WhatsApp thread per operator, stable across sessions so the agent keeps
 * its memory of the conversation. Prefixed so it can never collide with a buyer
 * thread that happens to use the same number.
 */
function operatorThreadId(phone: string): string {
  return `operator:${phone}`
}

export async function processOperatorInbound(
  payload: Payload,
  input: OperatorInboundInput,
): Promise<OperatorInboundOutcome> {
  const { operator } = input

  const clientId = await upsertOperatorRecord(payload, operator, input.operatorPhone)
  const conversationId = await upsertOperatorConversation(
    payload,
    operator.tenantId,
    clientId,
    operatorThreadId(input.operatorPhone),
  )

  try {
    await payload.create({
      collection: 'messages',
      overrideAccess: true,
      data: {
        tenant: toId(operator.tenantId),
        conversation: toId(conversationId),
        direction: 'inbound',
        author: 'human',
        text: input.operatorText,
        idempotencyKey: input.eventKey,
        processingState: 'completed',
      },
    })
  } catch {
    return { state: 'deduplicated' }
  }

  const agentBaseUrl = process.env.AGENT_INTERNAL_URL
  const secret = process.env.INTERNAL_SERVICE_SECRET
  if (!agentBaseUrl || !secret) {
    return { state: 'failed', reason: 'agent-not-configured' }
  }

  const reply = await requestSystemChat(
    { baseUrl: agentBaseUrl, secret },
    {
      tenantId: operator.tenantId,
      tenantSlug: operator.tenantSlug,
      userId: operator.userId,
      message: input.operatorText,
      threadId: `sys:${operator.tenantId}:${operator.userId}:whatsapp`,
    },
  )
  if (!reply.ok) return { state: 'failed', reason: reply.error.code }

  const outboundKey = `${input.eventKey}:reply`
  let outboundMessageId: string
  try {
    const created = await payload.create({
      collection: 'messages',
      overrideAccess: true,
      data: {
        tenant: toId(operator.tenantId),
        conversation: toId(conversationId),
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

  const config = loadEvolutionConfig()
  if (!config.ok) return { state: 'failed', reason: 'evolution-not-configured' }

  const sent = await createEvolutionClient({
    baseUrl: config.value.baseUrl,
    apiKey: config.value.apiKey,
  }).sendText({
    instanceName: input.instanceName,
    to: input.operatorPhone,
    text: reply.value.text,
  })

  await payload
    .update({
      collection: 'messages',
      id: outboundMessageId,
      overrideAccess: true,
      data: {
        deliveryState: sent.ok ? 'sent' : 'failed',
        ...(sent.ok && sent.value.providerMessageId
          ? { providerMessageId: sent.value.providerMessageId }
          : {}),
      },
    })
    .catch(() => null)

  return { state: 'completed', delivered: sent.ok }
}

/**
 * The operator's counterpart record inside their own tenant.
 *
 * `conversations.client` points at `buyer-clients`, so an operator thread needs
 * a row there. It is a placeholder for the relationship, not a lead — the name
 * says so, and the lead status stays Cold so it never surfaces as a prospect.
 */
async function upsertOperatorRecord(
  payload: Payload,
  operator: ResolvedOperator,
  phone: string,
): Promise<string> {
  const found = await payload.find({
    collection: 'buyer-clients',
    where: {
      and: [{ tenant: { equals: operator.tenantId } }, { normalizedPhone: { equals: phone } }],
    },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  if (found.docs[0]) return String(found.docs[0].id)

  const created = await payload.create({
    collection: 'buyer-clients',
    overrideAccess: true,
    data: {
      tenant: toId(operator.tenantId),
      name: `Equipo ${phone}`,
      normalizedPhone: phone,
      leadStatus: 'Cold',
    },
  })
  return String(created.id)
}

async function upsertOperatorConversation(
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
