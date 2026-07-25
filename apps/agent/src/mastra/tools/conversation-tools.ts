import { createTool } from '@mastra/core/tools'
import { z } from 'zod'
import { dataOperationOrError } from '../data-client'
import { tenantIdFrom, type ToolExecutionContext } from '../request-context'

/**
 * CRM conversation tools.
 *
 * These read the durable WhatsApp/web-chat history stored in Payload — the
 * agency's record of what buyers actually said. They are distinct from the
 * agent's own session memory, which only covers chats with the assistant.
 */

const messageShape = z.object({
  id: z.string(),
  conversationId: z.string(),
  direction: z.string(),
  author: z.string(),
  text: z.string(),
  createdAt: z.string(),
})

export const findConversationsTool = createTool({
  id: 'find-conversations',
  description:
    "List the agency's buyer conversations, most recently updated first. Filter by client id or channel.",
  inputSchema: z.object({
    clientId: z.string().optional(),
    channel: z.enum(['whatsapp', 'web-chat']).optional(),
    limit: z.number().optional(),
  }),
  outputSchema: z.union([
    z.object({
      conversations: z.array(
        z.object({
          id: z.string(),
          clientId: z.string(),
          channel: z.string(),
          channelThreadId: z.string(),
          botPaused: z.boolean(),
          updatedAt: z.string(),
        }),
      ),
    }),
    z.object({ error: z.string() }),
  ]),
  execute: async (input, context) => {
    const tenantId = tenantIdFrom(context as ToolExecutionContext)
    return dataOperationOrError(tenantId, 'conversations.list', { ...input })
  },
})

export const readConversationTool = createTool({
  id: 'read-conversation',
  description:
    'Read the recent messages of one buyer conversation in chronological order. Use it to recap what a buyer has been told.',
  inputSchema: z.object({
    conversationId: z.string(),
    limit: z.number().optional().describe('How many recent messages to read, capped at 25'),
  }),
  outputSchema: z.union([
    z.object({ conversationId: z.string(), messages: z.array(messageShape) }),
    z.object({ error: z.string() }),
  ]),
  execute: async ({ conversationId, limit }, context) => {
    const tenantId = tenantIdFrom(context as ToolExecutionContext)
    return dataOperationOrError(tenantId, 'conversations.messages', { conversationId, limit })
  },
})

export const searchMessagesTool = createTool({
  id: 'search-messages',
  description:
    'Find messages across all buyer conversations of the agency by text. Use it to answer questions like "who asked about the penthouse?".',
  inputSchema: z.object({
    text: z.string().optional().describe('Text fragment to look for'),
    conversationId: z.string().optional(),
    direction: z.enum(['inbound', 'outbound']).optional(),
    limit: z.number().optional(),
  }),
  outputSchema: z.union([
    z.object({ messages: z.array(messageShape) }),
    z.object({ error: z.string() }),
  ]),
  execute: async (input, context) => {
    const tenantId = tenantIdFrom(context as ToolExecutionContext)
    return dataOperationOrError(tenantId, 'messages.search', { ...input })
  },
})

export const conversationTools = {
  findConversationsTool,
  readConversationTool,
  searchMessagesTool,
}
