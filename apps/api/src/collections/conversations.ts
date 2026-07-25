import type { CollectionConfig } from 'payload'
import {
  assertTenantMembership,
  assignTenantFieldHook,
  authenticatedCreate,
  tenantScopedAccess,
} from '../access/tenant-access'

export const Conversations: CollectionConfig = {
  slug: 'conversations',
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
    { name: 'client', type: 'relationship', relationTo: 'buyer-clients', required: true },
    {
      name: 'channel',
      type: 'select',
      options: ['whatsapp', 'web-chat'],
      required: true,
    },
    { name: 'channelThreadId', type: 'text', required: true, index: true },
    { name: 'botPaused', type: 'checkbox', defaultValue: false },
  ],
  indexes: [{ fields: ['tenant', 'channel', 'channelThreadId'], unique: true }],
}
