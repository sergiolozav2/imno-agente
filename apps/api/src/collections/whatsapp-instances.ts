import type { CollectionConfig } from 'payload'
import {
  assertTenantMembership,
  assignTenantFieldHook,
  authenticatedCreate,
  tenantScopedAccess,
} from '../access/tenant-access'

export const WhatsappInstances: CollectionConfig = {
  slug: 'whatsapp-instances',
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
    { name: 'instanceName', type: 'text', required: true, unique: true, index: true },
    { name: 'externalInstanceId', type: 'text' },
    {
      name: 'connectionState',
      type: 'select',
      options: ['open', 'connecting', 'close'],
      required: true,
      defaultValue: 'close',
    },
    { name: 'webhookConfigured', type: 'checkbox', defaultValue: false },
  ],
  indexes: [
    { fields: ['tenant'], unique: true },
    { fields: ['instanceName'], unique: true },
  ],
}
