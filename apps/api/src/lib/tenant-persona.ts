import type { Payload } from 'payload'

/**
 * Read an agency's saved assistant persona so it can travel with an agent turn.
 *
 * The agent runtime holds no database, so whatever an agency edited in settings
 * has to be loaded here and sent with the request. Every field is optional: the
 * agent keeps a complete default persona and applies this over it, so an unset
 * field means "keep the default" rather than "blank".
 */

export interface ClientPersonaOverride {
  assistantName?: string
  businessName?: string
  language?: string
  tone?: string
  greeting?: string
  businessNotes?: string[]
  humanHandoffLine?: string
  maxReplyCharacters?: number
}

interface TenantPersonaSource {
  name?: unknown
  agentAssistantName?: unknown
  agentBusinessName?: unknown
  agentLanguage?: unknown
  agentTone?: unknown
  agentGreeting?: unknown
  agentBusinessNotes?: unknown
  agentHandoffLine?: unknown
  agentMaxReplyCharacters?: unknown
}

export async function loadTenantPersona(
  payload: Payload,
  tenantId: string,
): Promise<ClientPersonaOverride> {
  const tenant = (await payload
    .findByID({ collection: 'tenants', id: tenantId, depth: 0, overrideAccess: true })
    .catch(() => null)) as TenantPersonaSource | null
  if (!tenant) return {}

  return buildTenantPersona(tenant)
}

/** Split from the read so the mapping can be exercised without a database. */
export function buildTenantPersona(tenant: TenantPersonaSource): ClientPersonaOverride {
  const persona: ClientPersonaOverride = {}

  const assistantName = text(tenant.agentAssistantName)
  if (assistantName) persona.assistantName = assistantName

  // An agency that never set a public-facing name is still better served by its
  // own tenant name than by the generic default.
  const businessName = text(tenant.agentBusinessName) ?? text(tenant.name)
  if (businessName) persona.businessName = businessName

  const language = text(tenant.agentLanguage)
  if (language) persona.language = language

  const tone = text(tenant.agentTone)
  if (tone) persona.tone = tone

  const greeting = text(tenant.agentGreeting)
  if (greeting) persona.greeting = greeting

  const handoff = text(tenant.agentHandoffLine)
  if (handoff) persona.humanHandoffLine = handoff

  // Stored as one textarea because a line per fact is how agencies write them.
  const notes = text(tenant.agentBusinessNotes)
  if (notes) {
    persona.businessNotes = notes
      .split('\n')
      .map((note) => note.trim())
      .filter((note) => note.length > 0)
  }

  const maxCharacters = tenant.agentMaxReplyCharacters
  if (typeof maxCharacters === 'number' && Number.isFinite(maxCharacters) && maxCharacters > 0) {
    persona.maxReplyCharacters = Math.round(maxCharacters)
  }

  return persona
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined
}
