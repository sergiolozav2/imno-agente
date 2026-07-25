import type { CollectionConfig } from 'payload'
import {
  assertTenantMembership,
  assignTenantFieldHook,
  authenticatedCreate,
  tenantScopedAccess,
} from '../access/tenant-access'

export const MessageProcessing: CollectionConfig = {
  slug: 'message-processing',
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
      name: 'inboundMessage',
      type: 'relationship',
      relationTo: 'messages',
      required: true,
      unique: true,
      index: true,
    },
    {
      name: 'state',
      type: 'select',
      options: ['pending', 'processing', 'completed', 'failed', 'skipped'],
      required: true,
      defaultValue: 'pending',
    },
    { name: 'attempts', type: 'number', defaultValue: 0 },
    { name: 'safeError', type: 'text' },
  ],
  indexes: [{ fields: ['inboundMessage'], unique: true }],
}
