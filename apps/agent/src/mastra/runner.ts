import { randomUUID } from 'node:crypto'
import { mastraConfig, readSystemInstanceState } from './config'
import { mastra } from './index'
import { buildRequestContext } from './request-context'
import {
  agentMemory,
  systemThreadResource,
  whatsappThreadId,
  whatsappThreadResource,
} from './storage'

/**
 * Transport-neutral entry points for the two agents.
 *
 * The HTTP handler stays a thin adapter: it authenticates, parses, and calls one
 * of these. Thread and resource ids are derived here from server-supplied
 * identity, never from the request body's own opinion about who it is, so one
 * tenant's chat history can never be addressed by another.
 */

export interface SystemChatInput {
  tenantId: string
  tenantSlug: string
  userId: string
  message: string
  /** Continue an existing session; omit to start a new one. */
  threadId?: string
  language?: string
}

export interface SystemChatResult {
  text: string
  threadId: string
  toolCalls: string[]
}

export async function runSystemChat(input: SystemChatInput): Promise<SystemChatResult> {
  const resourceId = systemThreadResource(input.tenantId, input.userId)
  const threadId = input.threadId ?? `sys:${input.tenantId}:${input.userId}:${randomUUID()}`
  const language = input.language ?? mastraConfig.defaultLanguage
  const systemInstance = readSystemInstanceState()

  const requestContext = buildRequestContext({
    tenantId: input.tenantId,
    tenantSlug: input.tenantSlug,
    language,
    memoryResource: resourceId,
    memoryThread: threadId,
    ...(systemInstance ? { systemInstanceName: systemInstance.instanceName } : {}),
  })

  const agent = mastra.getAgentById('system-agent')
  const response = await agent.generate(input.message, {
    memory: { resource: resourceId, thread: threadId },
    requestContext,
    maxSteps: 12,
  })

  return {
    text: response.text ?? '',
    threadId,
    toolCalls: collectToolNames(response),
  }
}

export interface SystemSessionSummary {
  threadId: string
  title: string
  createdAt: string
  updatedAt: string
}

/**
 * List an operator's stored sessions. Exposed over HTTP so the app UI can render
 * a conversation sidebar from the same source the agent recalls from.
 */
export async function listSystemSessions(input: {
  tenantId: string
  userId: string
  limit?: number
}): Promise<SystemSessionSummary[]> {
  const resourceId = systemThreadResource(input.tenantId, input.userId)
  const result = await agentMemory.listThreads({
    filter: { resourceId },
    perPage: Math.min(Math.max(input.limit ?? 30, 1), 100),
    page: 0,
    orderBy: { field: 'updatedAt', direction: 'DESC' },
  })
  return result.threads.map((thread) => ({
    threadId: String(thread.id),
    title: thread.title ?? 'Untitled session',
    createdAt: toIso(thread.createdAt),
    updatedAt: toIso(thread.updatedAt),
  }))
}

export interface ClientReplyInput {
  tenantId: string
  tenantSlug: string
  /** Persisted conversation this WhatsApp thread maps to. */
  conversationId: string
  /** Buyer record the reply belongs to; fixes whose lead status may change. */
  clientId: string
  message: string
  language?: string
}

export interface ClientReplyResult {
  text: string
  threadId: string
  /** Lead status after the turn, when the agent changed it. */
  leadStatus?: string
  toolCalls: string[]
}

/**
 * Produce a buyer-facing reply. This returns text only: persisting the outbound
 * message and delivering it through Evolution stays with the API's processing
 * coordinator, which already owns idempotency and delivery state.
 */
export async function runClientReply(input: ClientReplyInput): Promise<ClientReplyResult> {
  const resourceId = whatsappThreadResource(input.tenantId)
  const threadId = whatsappThreadId(input.tenantId, input.conversationId)
  const language = input.language ?? mastraConfig.defaultLanguage

  const requestContext = buildRequestContext({
    tenantId: input.tenantId,
    tenantSlug: input.tenantSlug,
    language,
    clientId: input.clientId,
    conversationId: input.conversationId,
    memoryResource: resourceId,
    memoryThread: threadId,
  })

  const agent = mastra.getAgentById('client-agent')
  const response = await agent.generate(input.message, {
    memory: { resource: resourceId, thread: threadId },
    requestContext,
    maxSteps: 8,
  })

  const leadStatus = extractLeadStatus(response)

  return {
    text: response.text ?? '',
    threadId,
    ...(leadStatus ? { leadStatus } : {}),
    toolCalls: collectToolNames(response),
  }
}

interface ToolResultLike {
  toolName?: unknown
  result?: unknown
  output?: unknown
}

interface GenerateResponseLike {
  text?: unknown
  toolResults?: unknown
}

function toolResultsOf(response: unknown): ToolResultLike[] {
  const raw = (response as GenerateResponseLike | undefined)?.toolResults
  return Array.isArray(raw) ? (raw as ToolResultLike[]) : []
}

function collectToolNames(response: unknown): string[] {
  return toolResultsOf(response)
    .map((entry) => (typeof entry.toolName === 'string' ? entry.toolName : ''))
    .filter((name) => name.length > 0)
}

/**
 * Read the resulting lead status out of the turn's tool results so the caller
 * can log the escalation without re-querying the database.
 */
function extractLeadStatus(response: unknown): string | undefined {
  for (const entry of toolResultsOf(response)) {
    const payload = (entry.result ?? entry.output) as { leadStatus?: unknown } | undefined
    if (payload && typeof payload.leadStatus === 'string') {
      return payload.leadStatus
    }
  }
  return undefined
}

function toIso(value: unknown): string {
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'string') return value
  return new Date(0).toISOString()
}
