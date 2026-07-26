import type { GlobalConfig } from 'payload'

/**
 * The single WhatsApp line the platform itself talks to real-estate agencies
 * from — the counterpart of a tenant's `whatsapp-instances` row, except there
 * is exactly one of them for the whole deployment, so it is a global.
 *
 * It is written by the `pnpm wa:*` CLI scripts (an operator scans the QR from a
 * shell) rather than by a UI, which is why the instance token lives here: the
 * line is provisioned before anyone can edit env vars for it.
 */
export const SystemWhatsapp: GlobalConfig = {
  slug: 'system-whatsapp',
  label: 'System WhatsApp',
  access: {
    read: ({ req }) => Boolean(req.user),
    update: ({ req }) => Boolean(req.user),
  },
  admin: {
    description:
      'Provisioned from the CLI (pnpm wa:connect). Editing these values by hand will not re-pair the line.',
  },
  fields: [
    {
      name: 'instanceName',
      type: 'text',
      index: true,
      admin: { description: 'Evolution instance name. Convention: SYSTEM_<slug>.' },
    },
    { name: 'externalInstanceId', type: 'text' },
    {
      name: 'apiKey',
      type: 'text',
      admin: { description: 'Instance-scoped Evolution token returned at creation time.' },
    },
    {
      name: 'connectionState',
      type: 'select',
      options: ['open', 'connecting', 'close'],
      defaultValue: 'close',
    },
    { name: 'webhookConfigured', type: 'checkbox', defaultValue: false },
    {
      name: 'connectedNumber',
      type: 'text',
      admin: { description: 'Owner JID reported by Evolution once the QR is scanned.' },
    },
    { name: 'connectedAt', type: 'text' },
  ],
}
