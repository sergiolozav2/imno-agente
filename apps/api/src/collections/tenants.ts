import type { CollectionConfig, Field } from 'payload'
import { authenticatedCreate, tenantsOwnAccess } from '../access/tenant-access'
import { ensureTenantOwner } from '../hooks/ensure-tenant-owner'

/**
 * How this agency's buyer-facing WhatsApp assistant presents itself.
 *
 * Every field is optional: the agent keeps a complete default persona and treats
 * these as an overlay, so a tenant that fills in nothing still gets a working
 * assistant, and one that fills in only a name changes only the name.
 */
const agentPersonaFields: Field[] = [
  {
    name: 'agentAssistantName',
    type: 'text',
    admin: { description: 'Name the assistant introduces itself with on WhatsApp.' },
  },
  {
    name: 'agentBusinessName',
    type: 'text',
    admin: { description: 'Agency name as buyers should hear it. Defaults to the tenant name.' },
  },
  {
    name: 'agentLanguage',
    type: 'text',
    admin: { description: 'ISO code the assistant replies in (es, en, ca).' },
  },
  {
    name: 'agentTone',
    type: 'textarea',
    admin: { description: 'Voice guidance: formality, sentence length, how much to push.' },
  },
  {
    name: 'agentGreeting',
    type: 'textarea',
    admin: { description: 'Exact opening line for the first message of a conversation.' },
  },
  {
    name: 'agentBusinessNotes',
    type: 'textarea',
    admin: {
      description: 'Facts the assistant may state — hours, coverage, policy. One per line.',
    },
  },
  {
    name: 'agentHandoffLine',
    type: 'textarea',
    admin: { description: 'What to say when a buyer asks for a human.' },
  },
  {
    name: 'agentMaxReplyCharacters',
    type: 'number',
    admin: { description: 'Hard cap on reply length. WhatsApp rewards brevity.' },
  },
]

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
    ...agentPersonaFields,
  ],
}
