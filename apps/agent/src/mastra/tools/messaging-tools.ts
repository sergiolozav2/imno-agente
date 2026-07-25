import { createTool } from '@mastra/core/tools'
import { z } from 'zod'
import { readSystemInstanceState } from '../config'
import { dataOperationOrError } from '../data-client'
import { optionalContextValue, tenantIdFrom, type ToolExecutionContext } from '../request-context'

/**
 * Outbound messaging.
 *
 * The recipient is always a persisted, tenant-owned client id — the model
 * cannot dial an arbitrary number. Which WhatsApp line the message leaves from
 * is an operator decision (the `system_` instance selected via the CLI), not a
 * model decision.
 */
export const sendWhatsAppMessageTool = createTool({
  id: 'send-whatsapp-message',
  description: [
    "Send a WhatsApp message to one of the agency's buyer clients and record it in their conversation.",
    'Resolve the person with find-clients first to get their id.',
    'Draft the text, show it to the user, and only send once they agree.',
  ].join(' '),
  inputSchema: z.object({
    clientId: z.string().describe('Client id from find-clients'),
    text: z.string().min(1).describe('The exact message body to deliver'),
  }),
  outputSchema: z.union([
    z.object({
      delivered: z.boolean(),
      messageId: z.string(),
      conversationId: z.string(),
      instanceName: z.string(),
      to: z.string(),
    }),
    z.object({ error: z.string() }),
  ]),
  execute: async ({ clientId, text }, context) => {
    const execution = context as ToolExecutionContext
    const tenantId = tenantIdFrom(execution)

    // Prefer the instance pinned for this turn, then the operator's selection;
    // the API falls back to the tenant's own instance when neither is set.
    const instanceName =
      optionalContextValue(execution, 'systemInstanceName') ??
      readSystemInstanceState()?.instanceName

    return dataOperationOrError(tenantId, 'whatsapp.send', {
      clientId,
      text,
      ...(instanceName ? { instanceName } : {}),
    })
  },
})

export const messagingTools = { sendWhatsAppMessageTool }
