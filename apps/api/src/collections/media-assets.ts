import type { CollectionConfig } from 'payload'
import {
  assertTenantMembership,
  assignTenantFieldHook,
  authenticatedCreate,
  tenantScopedAccess,
} from '../access/tenant-access'

export const MediaAssets: CollectionConfig = {
  slug: 'media-assets',
  upload: {
    mimeTypes: ['image/*', 'model/gltf-binary', 'model/gltf+json', 'audio/*', 'video/mp4'],
  },
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
      name: 'kind',
      type: 'select',
      options: ['image', 'model-3d', 'music', 'video'],
      required: true,
      index: true,
    },
  ],
}
