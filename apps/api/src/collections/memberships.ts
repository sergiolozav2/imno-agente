import type { Access, CollectionConfig, Where } from 'payload'
import { authenticatedCreate } from '../access/tenant-access'
import { ownedTenantIds } from '../access/membership'

/** The linked user OR an owner of the target tenant may read a membership. */
const membershipReadAccess: Access = async ({ req }) => {
  if (!req.user) return false
  const owned = await ownedTenantIds(req)
  if (owned.length === 0) return { user: { equals: req.user.id } } as Where
  return {
    or: [{ user: { equals: req.user.id } }, { tenant: { in: owned } }],
  } as Where
}

export const Memberships: CollectionConfig = {
  slug: 'memberships',
  access: {
    read: membershipReadAccess,
    create: authenticatedCreate,
    update: ({ req }) => (req.user ? { user: { equals: req.user.id } } : false),
    delete: ({ req }) => (req.user ? { user: { equals: req.user.id } } : false),
  },
  fields: [
    { name: 'user', type: 'relationship', relationTo: 'users', required: true },
    { name: 'tenant', type: 'relationship', relationTo: 'tenants', required: true, index: true },
    {
      name: 'role',
      type: 'select',
      options: ['owner', 'member'],
      required: true,
      defaultValue: 'member',
    },
  ],
  indexes: [{ fields: ['user', 'tenant'], unique: true }],
}
