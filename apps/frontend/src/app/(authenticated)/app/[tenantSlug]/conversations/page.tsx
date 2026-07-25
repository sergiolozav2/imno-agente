import { redirect } from 'next/navigation'
import Link from 'next/link'
import { resolveTenant, authFetch } from '@/lib/auth'
import { getApiUrl } from '@/lib/config'
import { IconInbox, IconWhatsApp, IconChat } from '@/components/icons'

interface Conversation {
  id: string
  channel: 'whatsapp' | 'web-chat'
  botPaused: boolean
  createdAt: string
  client?: {
    id: string
    name: string
    normalizedPhone?: string
    leadStatus: 'Cold' | 'Warm' | 'Hot'
  }
}

interface ConversationsResponse {
  docs: Conversation[]
  totalDocs: number
}

const LEAD_LABELS: Record<'Cold' | 'Warm' | 'Hot', string> = {
  Cold: 'Frío',
  Warm: 'Templado',
  Hot: 'Caliente',
}

function leadBadge(status: 'Cold' | 'Warm' | 'Hot') {
  return status === 'Hot' ? 'badge-error' : status === 'Warm' ? 'badge-warning' : 'badge-info'
}

async function getConversations(tenantId: string): Promise<Conversation[]> {
  const apiUrl = getApiUrl()
  const response = await authFetch(
    `${apiUrl}/api/conversations?where[tenant][equals]=${tenantId}&limit=50&sort=-createdAt&depth=1`,
  )

  if (!response.ok) return []

  const data: ConversationsResponse = await response.json()
  return data.docs
}

export default async function ConversationsPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>
}) {
  const { tenantSlug } = await params
  const tenant = await resolveTenant(tenantSlug)

  if (!tenant) {
    redirect('/login')
  }

  const conversations = await getConversations(tenant.tenantId)

  return (
    <div className="container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Conversaciones</h1>
          <p className="page-subtitle">Revisa y gestiona las conversaciones con compradores</p>
        </div>
      </div>

      {conversations.length === 0 ? (
        <div className="empty-state">
          <span className="empty-state-icon">
            <IconInbox />
          </span>
          <h3>Sin conversaciones todavía</h3>
          <p className="page-subtitle" style={{ marginTop: 0, maxWidth: '32rem' }}>
            Las conversaciones se crean automáticamente cuando un comprador te contacta por WhatsApp
            o por el chat público.
          </p>
        </div>
      ) : (
        <div className="table-container">
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Canal</th>
                  <th>Estado del lead</th>
                  <th>Estado del bot</th>
                  <th>Iniciada</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {conversations.map((conv) => (
                  <tr key={conv.id}>
                    <td>
                      {conv.client ? (
                        <Link
                          href={`/app/${tenantSlug}/clients/${conv.client.id}`}
                          className="link"
                        >
                          {conv.client.name}
                        </Link>
                      ) : (
                        'Desconocido'
                      )}
                    </td>
                    <td>
                      <span
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem' }}
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
                      </span>
                    </td>
                    <td>
                      {conv.client ? (
                        <span className={`badge ${leadBadge(conv.client.leadStatus)}`}>
                          {LEAD_LABELS[conv.client.leadStatus]}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>
                      <span
                        className={`badge ${conv.botPaused ? 'badge-warning' : 'badge-success'}`}
                      >
                        {conv.botPaused ? 'Pausado' : 'Activo'}
                      </span>
                    </td>
                    <td style={{ color: 'var(--color-text-muted)' }}>
                      {new Date(conv.createdAt).toLocaleDateString()}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {conv.client && (
                        <Link
                          href={`/app/${tenantSlug}/clients/${conv.client.id}`}
                          className="btn btn-secondary btn-sm"
                        >
                          Ver
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
