import { createTool } from '@mastra/core/tools'
import { z } from 'zod'
import { dataOperationOrError } from '../data-client'
import { tenantIdFrom, type ToolExecutionContext } from '../request-context'

/**
 * Property tools.
 *
 * None of these take a tenant argument: the tenant comes from the request
 * context the HTTP handler built, so the model can only ever see and modify
 * listings belonging to the caller's agency.
 */

const propertyShape = z.object({
  id: z.string(),
  reference: z.string(),
  title: z.string(),
  description: z.string(),
  zone: z.string(),
  price: z.number().nullable(),
  currency: z.string(),
  pricingUnit: z.string(),
  status: z.string(),
  bedrooms: z.number().nullable(),
  bathrooms: z.number().nullable(),
  areaSqm: z.number().nullable(),
})

export const findPropertiesTool = createTool({
  id: 'find-properties',
  description:
    "Search the agency's own property listings by free text, zone, price range, bedrooms, or status. Use this before answering any question about what is available.",
  inputSchema: z.object({
    text: z
      .string()
      .optional()
      .describe('Free text to match against reference, title, zone, or description'),
    zone: z.string().optional().describe('Neighbourhood or area name'),
    status: z.enum(['available', 'reserved', 'sold']).optional(),
    minBedrooms: z.number().optional(),
    minPrice: z.number().optional(),
    maxPrice: z.number().optional(),
    limit: z.number().optional().describe('Maximum results, capped at 25'),
  }),
  outputSchema: z.union([
    z.object({ properties: z.array(propertyShape) }),
    z.object({ error: z.string() }),
  ]),
  execute: async (input, context) => {
    const tenantId = tenantIdFrom(context as ToolExecutionContext)
    return dataOperationOrError(tenantId, 'properties.search', { ...input })
  },
})

export const getPropertyTool = createTool({
  id: 'get-property',
  description: 'Read one property of the agency in full detail by its id.',
  inputSchema: z.object({
    propertyId: z.string().describe('Property id returned by find-properties'),
  }),
  outputSchema: z.union([z.object({ property: propertyShape }), z.object({ error: z.string() })]),
  execute: async ({ propertyId }, context) => {
    const tenantId = tenantIdFrom(context as ToolExecutionContext)
    return dataOperationOrError(tenantId, 'properties.get', { propertyId })
  },
})

export const updatePropertyTool = createTool({
  id: 'update-property',
  description:
    'Update editable fields of one property (title, description, price, currency, zone, status, pricing unit, bedrooms, bathrooms, area). Only send the fields that change. Confirm the change with the user before calling this.',
  inputSchema: z.object({
    propertyId: z.string(),
    patch: z
      .object({
        title: z.string().optional(),
        description: z.string().optional(),
        price: z.number().optional(),
        currency: z.string().optional(),
        zone: z.string().optional(),
        status: z.enum(['available', 'reserved', 'sold']).optional(),
        pricingUnit: z.enum(['per_sqm', 'total', 'per_month']).optional(),
        bedrooms: z.number().optional(),
        bathrooms: z.number().optional(),
        areaSqm: z.number().optional(),
      })
      .describe('Only the fields to change'),
  }),
  outputSchema: z.union([
    z.object({ property: propertyShape, updatedFields: z.array(z.string()) }),
    z.object({ error: z.string() }),
  ]),
  execute: async ({ propertyId, patch }, context) => {
    const tenantId = tenantIdFrom(context as ToolExecutionContext)
    return dataOperationOrError(tenantId, 'properties.update', { propertyId, patch })
  },
})

export const propertyTools = {
  findPropertiesTool,
  getPropertyTool,
  updatePropertyTool,
}

/** Read-only subset handed to the buyer-facing agent. */
export const publicPropertyTools = {
  findPropertiesTool,
  getPropertyTool,
}
