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

  await seedThreadTitle(threadId, input.message)

  return {
    text: finalText(response),
    threadId,
    toolCalls: collectToolNames(response),
  }
}

/**
 * Give a freshly created thread a human-readable name from its opening message.
 * Threads are created implicitly by `generate`, and an unnamed one shows up in
 * the app's session list as "Untitled session", so name it on the first turn
 * and leave it alone afterwards.
 */
async function seedThreadTitle(threadId: string, firstMessage: string): Promise<void> {
  try {
    const thread = await agentMemory.getThreadById({ threadId })
    if (!thread) return
    if (thread.title && thread.title !== threadId && thread.title !== 'New Thread') return

    const title = firstMessage.replace(/\s+/g, ' ').trim().slice(0, 60)
    if (title.length === 0) return
    await agentMemory.updateThread({ id: threadId, title, metadata: thread.metadata ?? {} })
  } catch {
    // A missing title is cosmetic; never fail a turn over it.
  }
}

export interface SystemSessionMessage {
  role: string
  text: string
  createdAt: string
}

/**
 * Read one stored session back for the app UI, so reopening a chat shows the
 * same history the agent recalls. The resource id is derived from server-side
 * identity and checked against the thread, so one operator cannot address
 * another's session by guessing its id.
 */
export async function readSystemSession(input: {
  tenantId: string
  userId: string
  threadId: string
  limit?: number
}): Promise<{ threadId: string; title: string; messages: SystemSessionMessage[] } | null> {
  const resourceId = systemThreadResource(input.tenantId, input.userId)
  const thread = await agentMemory.getThreadById({ threadId: input.threadId })
  if (!thread || thread.resourceId !== resourceId) return null

  const result = await agentMemory.recall({
    threadId: input.threadId,
    resourceId,
    perPage: Math.min(Math.max(input.limit ?? 100, 1), 200),
    page: 0,
  })

  const messages = result.messages
    .map((message) => ({
      role: String((message as { role?: unknown }).role ?? 'unknown'),
      text: storedMessageText(message),
      createdAt: toIso((message as { createdAt?: unknown }).createdAt),
    }))
    .filter((message) => message.text.length > 0 && message.role !== 'tool')

  return { threadId: input.threadId, title: thread.title ?? 'Untitled session', messages }
}

/** Reduce a stored message's structured content down to its prose. */
function storedMessageText(message: unknown): string {
  const content = (message as { content?: unknown }).content
  if (typeof content === 'string') return content
  if (content && typeof content === 'object') {
    const parts = (content as { parts?: unknown }).parts
    if (Array.isArray(parts)) {
      return parts
        .map((part) => {
          if (part && typeof part === 'object' && (part as { type?: unknown }).type === 'text') {
            const text = (part as { text?: unknown }).text
            return typeof text === 'string' ? text : ''
          }
          return ''
        })
        .filter((text) => text.length > 0)
        .join(' ')
        .trim()
    }
    const text = (content as { text?: unknown }).text
    if (typeof text === 'string') return text
  }
  return ''
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
    text: finalText(response),
    threadId,
    ...(leadStatus ? { leadStatus } : {}),
    toolCalls: collectToolNames(response),
  }
}

interface ToolResultLike {
  toolName?: unknown
  result?: unknown
  output?: unknown
  /** Mastra wraps tool chunks in `payload`; older shapes were flat. */
  payload?: { toolName?: unknown; result?: unknown; output?: unknown }
}

interface GenerateResponseLike {
  text?: unknown
  toolResults?: unknown
  steps?: unknown
}

/**
 * The text to actually send as one reply.
 *
 * A tool-using turn produces text in several steps — typically a filler line
 * ("let me check that for you") before each tool call and the real answer last.
 * The aggregate `text` field concatenates all of them, which on WhatsApp reads
 * as the agent repeating itself, so take the last step that produced text and
 * fall back to the aggregate only for single-step turns.
 */
function finalText(response: unknown): string {
  const steps = (response as GenerateResponseLike | undefined)?.steps
  if (Array.isArray(steps)) {
    for (let index = steps.length - 1; index >= 0; index -= 1) {
      const text = (steps[index] as { text?: unknown } | undefined)?.text
      if (typeof text === 'string' && text.trim().length > 0) {
        return text.trim()
      }
    }
  }
  const aggregate = (response as GenerateResponseLike | undefined)?.text
  return typeof aggregate === 'string' ? aggregate.trim() : ''
}

/** Flatten tool results across both the chunk shape and the legacy flat shape. */
function toolResultsOf(response: unknown): { toolName?: string; result?: unknown }[] {
  const raw = (response as GenerateResponseLike | undefined)?.toolResults
  const entries = Array.isArray(raw) ? (raw as ToolResultLike[]) : []
  return entries.map((entry) => {
    const source = entry.payload ?? entry
    const toolName = source.toolName
    return {
      ...(typeof toolName === 'string' ? { toolName } : {}),
      result: source.result ?? source.output,
    }
  })
}

function collectToolNames(response: unknown): string[] {
  return toolResultsOf(response)
    .map((entry) => entry.toolName ?? '')
    .filter((name) => name.length > 0)
}

/**
 * Read the resulting lead status out of the turn's tool results so the caller
 * can log the escalation without re-querying the database.
 */
function extractLeadStatus(response: unknown): string | undefined {
  for (const entry of toolResultsOf(response)) {
    const result = entry.result as { leadStatus?: unknown } | undefined
    if (result && typeof result.leadStatus === 'string') {
      return result.leadStatus
    }
  }
  return undefined
}

function toIso(value: unknown): string {
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'string') return value
  return new Date(0).toISOString()
}
