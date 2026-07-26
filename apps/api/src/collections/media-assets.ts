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
    /**
     * Public. Two consumers outside any browser session need the bytes: the
     * agent container reads property photos to render videos, and WhatsApp
     * fetches the finished video from this URL. Both are anonymous to Payload,
     * so a tenant predicate here would 403 them. Filenames are the only thing
     * guarding an asset — acceptable while the listings are public anyway.
     */
    read: () => true,
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
