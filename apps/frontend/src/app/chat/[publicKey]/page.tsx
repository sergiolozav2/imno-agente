import { getApiUrl } from '@/lib/config'
import { Chat } from './chat-client'

interface Tenant {
  id: string
  name: string
  slug: string
  publicChatKey: string
}

async function resolveTenant(publicKey: string): Promise<Tenant | null> {
  try {
    const apiUrl = getApiUrl()
    const response = await fetch(
      `${apiUrl}/api/tenants?where[publicChatKey][equals]=${publicKey}&limit=1`,
    )

    if (!response.ok) return null

    const data = await response.json()
    return data.docs?.[0] || null
  } catch {
    return null
  }
}

export default async function PublicChatPage({
  params,
}: {
  params: Promise<{ publicKey: string }>
}) {
  const { publicKey } = await params
  const tenant = await resolveTenant(publicKey)

  if (!tenant) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
        }}
      >
        <div className="card" style={{ textAlign: 'center', maxWidth: '400px' }}>
          <h2 style={{ marginBottom: '0.5rem' }}>Chat no encontrado</h2>
          <p className="page-subtitle" style={{ marginTop: 0 }}>
            Este enlace de chat no es válido o ha sido desactivado.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
        background:
          'radial-gradient(1000px 500px at 100% -10%, var(--color-brand-100), transparent), var(--color-bg)',
      }}
    >
      <Chat tenantId={tenant.id} tenantName={tenant.name} publicChatKey={publicKey} />
    </div>
  )
}
