import { redirect } from 'next/navigation'
import Link from 'next/link'
import { resolveTenant, authFetch } from '@/lib/auth'
import { getApiUrl } from '@/lib/config'
import { IconArrowLeft, IconPhone, IconMail, IconWhatsApp, IconChat } from '@/components/icons'
import { MessagesPanel, type ChatMessage } from './messages-panel'
import { ClientActions } from './client-actions'
import { LEAD_LABELS, leadBadge, type BuyerClient } from '../client-types'

interface Conversation {
  id: string
  channel: 'whatsapp' | 'web-chat'
  botPaused: boolean
  createdAt: string
}

async function getClient(id: string): Promise<BuyerClient | null> {
  const apiUrl = getApiUrl()
  const response = await authFetch(`${apiUrl}/api/buyer-clients/${id}?depth=1`)
  if (!response.ok) return null
  return response.json()
}

async function getConversations(tenantId: string, clientId: string): Promise<Conversation[]> {
  const apiUrl = getApiUrl()
  const response = await authFetch(
    `${apiUrl}/api/conversations?where[tenant][equals]=${tenantId}&where[client][equals]=${clientId}&limit=20`,
  )
  if (!response.ok) return []
  const data = await response.json()
  return data.docs || []
}

async function getMessages(tenantId: string, conversationId: string): Promise<ChatMessage[]> {
  const apiUrl = getApiUrl()
  const response = await authFetch(
    `${apiUrl}/api/messages?where[tenant][equals]=${tenantId}&where[conversation][equals]=${conversationId}&limit=100&sort=createdAt`,
  )
  if (!response.ok) return []
  const data = await response.json()
  return data.docs || []
}

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; id: string }>
}) {
  const { tenantSlug, id } = await params
  const tenant = await resolveTenant(tenantSlug)

  if (!tenant) {
    redirect('/login')
  }

  const client = await getClient(id)

  if (!client) {
    return (
      <div className="container">
        <div className="alert alert-error">Cliente no encontrado</div>
        <Link
          href={`/app/${tenantSlug}/clients`}
          className="btn btn-secondary"
          style={{ marginTop: '1rem' }}
        >
          <IconArrowLeft width={18} height={18} /> Volver a clientes
        </Link>
      </div>
    )
  }

  const conversations = await getConversations(tenant.tenantId, id)
  const firstConversation = conversations[0]
  const messages = firstConversation ? await getMessages(tenant.tenantId, firstConversation.id) : []

  return (
    <div className="container">
      <Link href={`/app/${tenantSlug}/clients`} className="breadcrumb">
        <IconArrowLeft width={16} height={16} /> Volver a clientes
      </Link>

      <div className="grid-2" style={{ gap: '1.5rem' }}>
        {/* Left: Client info */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="card">
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: '1rem',
                marginBottom: '1rem',
              }}
            >
              <div>
                <h1 className="page-title" style={{ marginBottom: '0.25rem' }}>
                  {client.name}
                </h1>
                <p className="page-subtitle" style={{ marginTop: 0 }}>
                  Cliente desde {new Date(client.createdAt).toLocaleDateString()}
                </p>
              </div>
              <span className={`badge ${leadBadge(client.leadStatus)}`}>
                {LEAD_LABELS[client.leadStatus]}
              </span>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <ClientActions client={client} tenantSlug={tenantSlug} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
              {client.normalizedPhone && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.625rem',
                    color: 'var(--color-ink-700)',
                  }}
                >
                  <IconPhone width={18} height={18} />
                  <span>{client.normalizedPhone}</span>
                </div>
              )}
              {client.email && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.625rem',
                    color: 'var(--color-ink-700)',
                  }}
                >
                  <IconMail width={18} height={18} />
                  <span>{client.email}</span>
                </div>
              )}
            </div>
          </div>

          <div className="card">
            <h3 className="card-title" style={{ marginBottom: '0.75rem' }}>
              Conversaciones
            </h3>
            {conversations.length === 0 ? (
              <p className="page-subtitle" style={{ marginTop: 0 }}>
                Sin conversaciones todavía
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {conversations.map((conv) => (
                  <div
                    key={conv.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '0.75rem',
                      background: 'var(--color-surface-2)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-border)',
                    }}
                  >
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        fontSize: '0.875rem',
                      }}
                    >
                      {conv.channel === 'whatsapp' ? (
                        <>
                          <IconWhatsApp width={16} height={16} /> WhatsApp
                        </>
                      ) : (
                        <>
                          <IconChat width={16} height={16} /> Chat web
                        </>
                      )}
                      {conv.botPaused && (
                        <span className="badge badge-warning" style={{ marginLeft: '0.25rem' }}>
                          Bot pausado
                        </span>
                      )}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                      {new Date(conv.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Messages */}
        <div>
          <div
            className="card card-flush"
            style={{ height: '620px', display: 'flex', flexDirection: 'column' }}
          >
            <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--color-border)' }}>
              <h3 className="card-title">Mensajes</h3>
            </div>

            <MessagesPanel
              tenantId={tenant.tenantId}
              conversationId={firstConversation ? firstConversation.id : null}
              initialMessages={messages}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
