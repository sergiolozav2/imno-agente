import { createTool } from '@mastra/core/tools'
import { z } from 'zod'
import { agentMemory } from '../storage'
import { optionalContextValue, type ToolExecutionContext } from '../request-context'

/**
 * Session recall.
 *
 * Every chat with an agent is persisted as a Mastra thread keyed by a
 * tenant-scoped resource id, so "what did we talk about yesterday?" is answered
 * by listing this resource's own threads — never another tenant's. The model
 * has no clock of its own, so it also needs `get-current-datetime` before it
 * can resolve words like "yesterday" into a date range.
 */

const MAX_MESSAGES_PER_SESSION = 40

interface DBMessageLike {
  id?: unknown
  role?: unknown
  createdAt?: unknown
  content?: unknown
}

/**
 * Pull readable text out of a stored message. Mastra keeps structured content
 * (parts, tool calls); this reduces it to the prose a summary needs.
 */
function messageText(message: DBMessageLike): string {
  const content = message.content
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

function isoOf(value: unknown): string {
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'string') return value
  return new Date(0).toISOString()
}

export const getCurrentDateTimeTool = createTool({
  id: 'get-current-datetime',
  description:
    'Get the current date and time. Call this before interpreting relative dates such as "yesterday", "last week", or "this month".',
  inputSchema: z.object({}),
  outputSchema: z.object({
    iso: z.string(),
    date: z.string(),
    weekday: z.string(),
    timeZone: z.string(),
  }),
  execute: async () => {
    const now = new Date()
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
    return {
      iso: now.toISOString(),
      date: now.toISOString().slice(0, 10),
      weekday: now.toLocaleDateString('en-US', { weekday: 'long' }),
      timeZone,
    }
  },
})

export const listPastSessionsTool = createTool({
  id: 'list-past-sessions',
  description: [
    'List previous chat sessions with this assistant, newest first, with their titles and dates.',
    'Use it to answer "what did we talk about yesterday?" — get the current date first, then read the session you need.',
  ].join(' '),
  inputSchema: z.object({
    limit: z.number().optional().describe('How many sessions to list (default 15)'),
    since: z
      .string()
      .optional()
      .describe('ISO date; only sessions updated on or after this moment are returned'),
  }),
  outputSchema: z.union([
    z.object({
      sessions: z.array(
        z.object({
          threadId: z.string(),
          title: z.string(),
          createdAt: z.string(),
          updatedAt: z.string(),
          isCurrentSession: z.boolean(),
        }),
      ),
    }),
    z.object({ error: z.string() }),
  ]),
  execute: async ({ limit, since }, context) => {
    const execution = context as ToolExecutionContext
    const resourceId = optionalContextValue(execution, 'memoryResource')
    if (!resourceId) {
      return { error: 'No session history is available for this caller.' }
    }
    const currentThread = optionalContextValue(execution, 'memoryThread')
    const sinceMs = since ? Date.parse(since) : Number.NaN

    try {
      const result = await agentMemory.listThreads({
        filter: { resourceId },
        perPage: Math.min(Math.max(limit ?? 15, 1), 50),
        page: 0,
        orderBy: { field: 'updatedAt', direction: 'DESC' },
      })
      const sessions = result.threads
        .map((thread) => ({
          threadId: String(thread.id),
          title: thread.title ?? 'Untitled session',
          createdAt: isoOf(thread.createdAt),
          updatedAt: isoOf(thread.updatedAt),
          isCurrentSession: String(thread.id) === currentThread,
        }))
        .filter((session) =>
          Number.isNaN(sinceMs) ? true : Date.parse(session.updatedAt) >= sinceMs,
        )
      return { sessions }
    } catch {
      return { error: 'Session history could not be read.' }
    }
  },
})

export const readPastSessionTool = createTool({
  id: 'read-past-session',
  description:
    'Read the messages of one previous chat session with this assistant, identified by the thread id from list-past-sessions.',
  inputSchema: z.object({
    threadId: z.string(),
    limit: z.number().optional(),
  }),
  outputSchema: z.union([
    z.object({
      threadId: z.string(),
      title: z.string(),
      messages: z.array(z.object({ role: z.string(), text: z.string(), createdAt: z.string() })),
    }),
    z.object({ error: z.string() }),
  ]),
  execute: async ({ threadId, limit }, context) => {
    const execution = context as ToolExecutionContext
    const resourceId = optionalContextValue(execution, 'memoryResource')
    if (!resourceId) {
      return { error: 'No session history is available for this caller.' }
    }

    try {
      // Ownership check: a thread belonging to another resource (another tenant
      // or user) is reported as simply not found.
      const thread = await agentMemory.getThreadById({ threadId })
      if (!thread || thread.resourceId !== resourceId) {
        return { error: 'That session was not found.' }
      }

      const result = await agentMemory.recall({
        threadId,
        resourceId,
        perPage: Math.min(Math.max(limit ?? MAX_MESSAGES_PER_SESSION, 1), MAX_MESSAGES_PER_SESSION),
        page: 0,
      })

      const messages = result.messages
        .map((message) => ({
          role: String((message as DBMessageLike).role ?? 'unknown'),
          text: messageText(message as DBMessageLike),
          createdAt: isoOf((message as DBMessageLike).createdAt),
        }))
        .filter((message) => message.text.length > 0)

      return { threadId, title: thread.title ?? 'Untitled session', messages }
    } catch {
      return { error: 'That session could not be read.' }
    }
  },
})

export const sessionTools = {
  getCurrentDateTimeTool,
  listPastSessionsTool,
  readPastSessionTool,
}
