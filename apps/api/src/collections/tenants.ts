import type { CollectionConfig } from 'payload'
import { authenticatedCreate, tenantsOwnAccess } from '../access/tenant-access'
import { ensureTenantOwner } from '../hooks/ensure-tenant-owner'

export const Tenants: CollectionConfig = {
  slug: 'tenants',
  admin: { useAsTitle: 'name' },
  access: {
    read: tenantsOwnAccess,
    create: authenticatedCreate,
    update: tenantsOwnAccess,
    delete: tenantsOwnAccess,
  },
  hooks: {
    afterChange: [ensureTenantOwner],
  },
  fields: [
    { name: 'slug', type: 'text', required: true, unique: true, index: true },
    { name: 'name', type: 'text', required: true },
    { name: 'countryCode', type: 'text', required: true, defaultValue: 'ES' },
    { name: 'publicChatKey', type: 'text', required: true, unique: true, index: true },
    { name: 'allowedOrigins', type: 'text', hasMany: true },
  ],
}
