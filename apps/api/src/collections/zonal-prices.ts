import type { CollectionConfig } from 'payload'
import {
  assertTenantMembership,
  assignTenantFieldHook,
  authenticatedCreate,
  tenantScopedAccess,
} from '../access/tenant-access'

export const ZonalPrices: CollectionConfig = {
  slug: 'zonal-prices',
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
    { name: 'zone', type: 'text', required: true, index: true },
    {
      name: 'pricingUnit',
      type: 'select',
      options: ['per_sqm', 'total', 'per_month'],
      required: true,
    },
    { name: 'amount', type: 'number', required: true },
    { name: 'currency', type: 'text', required: true, defaultValue: 'EUR' },
  ],
  indexes: [{ fields: ['tenant', 'zone', 'pricingUnit'], unique: true }],
}
