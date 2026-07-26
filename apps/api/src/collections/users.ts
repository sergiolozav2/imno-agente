import type { CollectionConfig } from 'payload'
import { normalizePhone } from '@imno/domain'

/**
 * Store the operator's WhatsApp number in the same E.164 shape the ingress path
 * derives from a provider JID, so the two can be compared directly. Input in a
 * national format is read against `DEFAULT_COUNTRY_CODE`; anything already
 * international is taken as written, whatever country it belongs to.
 */
function normalizeWhatsappPhone(value: unknown): string | null | undefined {
  if (value === null || value === undefined) return value
  if (typeof value !== 'string') return undefined
  if (value.trim().length === 0) return null

  const result = normalizePhone(value, process.env.DEFAULT_COUNTRY_CODE || 'ES')
  return result.ok ? result.value.e164 : value.trim()
}

export const Users: CollectionConfig = {
  slug: 'users',
  auth: true,
  admin: { useAsTitle: 'email' },
  access: {
    read: ({ req }) => Boolean(req.user),
    create: () => true,
    update: ({ req }) => Boolean(req.user),
    delete: ({ req }) => Boolean(req.user),
  },
  fields: [
    { name: 'displayName', type: 'text' },
    {
      name: 'whatsappPhone',
      type: 'text',
      index: true,
      hooks: { beforeChange: [({ value }) => normalizeWhatsappPhone(value)] },
      admin: {
        description:
          'E.164 number this operator messages the platform line from. Identifies them on inbound.',
      },
    },
  ],
}
