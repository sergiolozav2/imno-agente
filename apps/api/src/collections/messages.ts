import type { CollectionConfig } from 'payload'
import {
  assertTenantMembership,
  assignTenantFieldHook,
  authenticatedCreate,
  tenantScopedAccess,
} from '../access/tenant-access'

export const Messages: CollectionConfig = {
  slug: 'messages',
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
      name: 'conversation',
      type: 'relationship',
      relationTo: 'conversations',
      required: true,
      index: true,
    },
    {
      name: 'direction',
      type: 'select',
      options: ['inbound', 'outbound'],
      required: true,
    },
    {
      name: 'author',
      type: 'select',
      options: ['buyer', 'ai', 'human', 'system'],
      required: true,
    },
    { name: 'text', type: 'textarea', required: true },
    { name: 'providerMessageId', type: 'text', index: true },
    { name: 'idempotencyKey', type: 'text', required: true, index: true },
    {
      name: 'processingState',
      type: 'select',
      options: ['pending', 'processing', 'completed', 'failed', 'skipped'],
    },
    {
      name: 'deliveryState',
      type: 'select',
      options: ['pending', 'sent', 'failed', 'unknown'],
    },
  ],
}
