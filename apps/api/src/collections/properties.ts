import type { CollectionConfig } from 'payload'
import {
  assertTenantMembership,
  assignTenantFieldHook,
  authenticatedCreate,
  tenantScopedAccess,
} from '../access/tenant-access'

export const Properties: CollectionConfig = {
  slug: 'properties',
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
    { name: 'reference', type: 'text', required: true },
    { name: 'title', type: 'text', required: true },
    { name: 'description', type: 'textarea' },
    { name: 'price', type: 'number', required: true },
    { name: 'currency', type: 'text', required: true, defaultValue: 'EUR' },
    { name: 'zone', type: 'text', required: true, index: true },
    {
      name: 'pricingUnit',
      type: 'select',
      options: ['per_sqm', 'total', 'per_month'],
      required: true,
      defaultValue: 'total',
    },
    {
      name: 'status',
      type: 'select',
      options: ['available', 'reserved', 'sold'],
      required: true,
      defaultValue: 'available',
    },
    { name: 'images', type: 'relationship', relationTo: 'media-assets', hasMany: true },
    { name: 'mainImage', type: 'relationship', relationTo: 'media-assets' },
    { name: 'model3d', type: 'relationship', relationTo: 'media-assets' },
    { name: 'bedrooms', type: 'number' },
    { name: 'bathrooms', type: 'number' },
    { name: 'areaSqm', type: 'number' },
  ],
}
