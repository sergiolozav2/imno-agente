import { createTool } from '@mastra/core/tools'
import { z } from 'zod'
import { dataOperationOrError } from '../data-client'
import { optionalContextValue, tenantIdFrom, type ToolExecutionContext } from '../request-context'

/**
 * Buyer/lead tools.
 *
 * Lead temperature is the one field both agents can write, so it carries an
 * explicit rule: promotion only. The API enforces it too, which keeps a
 * mis-firing model from cooling down a qualified lead.
 */

const clientShape = z.object({
  id: z.string(),
  name: z.string(),
  normalizedPhone: z.string().nullable(),
  email: z.string().nullable(),
  leadStatus: z.string(),
})

export const findClientsTool = createTool({
  id: 'find-clients',
  description:
    "Search the agency's buyer clients by name, email, or phone, optionally filtered by lead status (Cold, Warm, Hot). Use this to resolve a person mentioned by name into a client id.",
  inputSchema: z.object({
    text: z.string().optional().describe('Name, email, or phone fragment'),
    leadStatus: z.enum(['Cold', 'Warm', 'Hot']).optional(),
    limit: z.number().optional(),
  }),
  outputSchema: z.union([
    z.object({ clients: z.array(clientShape) }),
    z.object({ error: z.string() }),
  ]),
  execute: async (input, context) => {
    const tenantId = tenantIdFrom(context as ToolExecutionContext)
    return dataOperationOrError(tenantId, 'clients.search', { ...input })
  },
})

export const getClientTool = createTool({
  id: 'get-client',
  description: 'Read one buyer client of the agency by id.',
  inputSchema: z.object({ clientId: z.string() }),
  outputSchema: z.union([z.object({ client: clientShape }), z.object({ error: z.string() })]),
  execute: async ({ clientId }, context) => {
    const tenantId = tenantIdFrom(context as ToolExecutionContext)
    return dataOperationOrError(tenantId, 'clients.get', { clientId })
  },
})

export const updateClientTool = createTool({
  id: 'update-client',
  description:
    "Update a buyer client's name, email, or lead status. Confirm the change with the user before calling this.",
  inputSchema: z.object({
    clientId: z.string(),
    patch: z.object({
      name: z.string().optional(),
      email: z.string().optional(),
      leadStatus: z.enum(['Cold', 'Warm', 'Hot']).optional(),
    }),
  }),
  outputSchema: z.union([
    z.object({ client: clientShape, updatedFields: z.array(z.string()) }),
    z.object({ error: z.string() }),
  ]),
  execute: async ({ clientId, patch }, context) => {
    const tenantId = tenantIdFrom(context as ToolExecutionContext)
    return dataOperationOrError(tenantId, 'clients.update', { clientId, patch })
  },
})

export const setLeadStatusTool = createTool({
  id: 'set-lead-status',
  description: [
    'Raise the interest level of a buyer: Cold (just browsing), Warm/templado (comparing, asking for details),',
    'Hot (explicit buying intent, e.g. "me interesa", "quiero comprar", "agendar cita", "podría visitarlo").',
    'Interest only ever goes up — a lower status is ignored. Include a short reason quoting the buyer.',
  ].join(' '),
  inputSchema: z.object({
    clientId: z
      .string()
      .optional()
      .describe('Omit inside a WhatsApp conversation: the current buyer is used automatically'),
    status: z.enum(['Cold', 'Warm', 'Hot']),
    reason: z.string().describe('Short justification, ideally the buyer phrase that triggered it'),
  }),
  outputSchema: z.union([
    z.object({
      clientId: z.string(),
      leadStatus: z.string(),
      previousLeadStatus: z.string().optional(),
      changed: z.boolean(),
    }),
    z.object({ error: z.string() }),
  ]),
  execute: async ({ clientId, status, reason }, context) => {
    const execution = context as ToolExecutionContext
    const tenantId = tenantIdFrom(execution)
    // In a WhatsApp turn the buyer is fixed by the request context; the model
    // does not get to choose whose record it escalates.
    const targetClientId = optionalContextValue(execution, 'clientId') ?? clientId
    if (!targetClientId) {
      return { error: 'No client id available. Look the buyer up with find-clients first.' }
    }
    return dataOperationOrError(tenantId, 'clients.setLeadStatus', {
      clientId: targetClientId,
      status,
      reason,
    })
  },
})

export const clientTools = {
  findClientsTool,
  getClientTool,
  updateClientTool,
  setLeadStatusTool,
}
