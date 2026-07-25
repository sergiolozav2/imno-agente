import type { CollectionConfig } from 'payload'
import {
  assertTenantMembership,
  assignTenantFieldHook,
  authenticatedCreate,
  tenantScopedAccess,
} from '../access/tenant-access'

export const WebhookReceipts: CollectionConfig = {
  slug: 'webhook-receipts',
  access: {
    read: tenantScopedAccess(),
    update: tenantScopedAccess(),
    delete: tenantScopedAccess(),
    create: authenticatedCreate,
  },
  hooks: {
    beforeChange: [assertTenantMembership()],
  },
  fields: [
    {
      name: 'tenant',
      type: 'relationship',
      relationTo: 'tenants',
      required: true,
      index: true,
      hooks: { beforeChange: [assignTenantFieldHook] },
      admin: { readOnly: true },
    },
    {
      name: 'instance',
      type: 'relationship',
      relationTo: 'whatsapp-instances',
      required: true,
    },
    { name: 'providerEventKey', type: 'text', required: true, index: true },
    { name: 'acceptedEventType', type: 'text', required: true },
    { name: 'receivedAt', type: 'date', required: true },
  ],
  indexes: [{ fields: ['instance', 'providerEventKey'], unique: true }],
}
