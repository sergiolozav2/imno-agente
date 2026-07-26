import { redirect } from 'next/navigation'
import { authFetch, getSession, resolveTenant } from '@/lib/auth'
import { AgentPersonaForm, type AgentPersona } from './agent-persona-form'
import { OperatorPhoneCard } from './operator-phone-card'

/**
 * Everything an agency configures about itself and its assistant.
 *
 * Integraciones covers connecting channels; this page covers what happens once
 * they are connected: who the platform line recognises, and how the buyer-facing
 * assistant sounds.
 */

interface TenantSettings extends Partial<Record<keyof AgentPersona, unknown>> {
  name?: string
}

async function getTenantSettings(tenantId: string): Promise<TenantSettings | null> {
  const response = await authFetch(`/api/tenants/${tenantId}`)
  if (!response.ok) return null
  return (await response.json().catch(() => null)) as TenantSettings | null
}

async function getOperatorPhone(): Promise<string | null> {
  const session = await getSession()
  if (!session) return null
  const response = await authFetch(`/api/users/${session.user.id}`)
  if (!response.ok) return null
  const data = await response.json()
  return typeof data?.whatsappPhone === 'string' ? data.whatsappPhone : null
}

/** Empty rather than absent, so the form's inputs stay controlled. */
function toFormValues(tenant: TenantSettings | null): AgentPersona {
  const text = (value: unknown) => (typeof value === 'string' ? value : '')
  return {
    agentAssistantName: text(tenant?.agentAssistantName),
    agentBusinessName: text(tenant?.agentBusinessName),
    agentLanguage: text(tenant?.agentLanguage),
    agentTone: text(tenant?.agentTone),
    agentGreeting: text(tenant?.agentGreeting),
    agentBusinessNotes: text(tenant?.agentBusinessNotes),
    agentHandoffLine: text(tenant?.agentHandoffLine),
    agentMaxReplyCharacters:
      typeof tenant?.agentMaxReplyCharacters === 'number'
        ? String(tenant.agentMaxReplyCharacters)
        : '',
  }
}

export default async function ConfigurationPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>
}) {
  const { tenantSlug } = await params
  const tenant = await resolveTenant(tenantSlug)

  if (!tenant) {
    redirect('/login')
  }

  const [settings, operatorPhone] = await Promise.all([
    getTenantSettings(tenant.tenantId),
    getOperatorPhone(),
  ])

  return (
    <div className="container" style={{ maxWidth: '900px' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Configuración</h1>
          <p className="page-subtitle">
            Tus datos y la personalidad del asistente que atiende a tus clientes
          </p>
        </div>
      </div>

      <OperatorPhoneCard initialPhone={operatorPhone} />

      <AgentPersonaForm
        tenantSlug={tenantSlug}
        tenantName={settings?.name ?? 'tu agencia'}
        initial={toFormValues(settings)}
      />
    </div>
  )
}
