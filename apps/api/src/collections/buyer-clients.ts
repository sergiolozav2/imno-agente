import type { CollectionConfig } from 'payload'
import {
  assertTenantMembership,
  assignTenantFieldHook,
  authenticatedCreate,
  tenantScopedAccess,
} from '../access/tenant-access'

export const BuyerClients: CollectionConfig = {
  slug: 'buyer-clients',
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
    { name: 'name', type: 'text', required: true },
    { name: 'normalizedPhone', type: 'text', index: true },
    { name: 'email', type: 'text' },
    {
      name: 'leadStatus',
      type: 'select',
      options: ['Cold', 'Warm', 'Hot'],
      required: true,
      defaultValue: 'Cold',
    },
  ],
  indexes: [{ fields: ['tenant', 'normalizedPhone'], unique: true }],
}
