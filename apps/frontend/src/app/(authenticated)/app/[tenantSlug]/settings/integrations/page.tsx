import { redirect } from 'next/navigation'
import { resolveTenant, authFetch } from '@/lib/auth'
import { getApiUrl } from '@/lib/config'
import { IntegrationsClient } from './integrations-client'
import type { WhatsAppInstance } from './use-whatsapp-connection'

async function getWhatsAppInstance(tenantId: string): Promise<WhatsAppInstance | null> {
  const apiUrl = getApiUrl()
  const response = await authFetch(
    `${apiUrl}/api/whatsapp-instances?where[tenant][equals]=${tenantId}&limit=1`,
  )
  if (!response.ok) return null
  const data = await response.json()
  return data.docs?.[0] || null
}

export default async function IntegrationsPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>
}) {
  const { tenantSlug } = await params
  const tenant = await resolveTenant(tenantSlug)

  if (!tenant) {
    redirect('/login')
  }

  const whatsappInstance = await getWhatsAppInstance(tenant.tenantId)

  return (
    <div className="container" style={{ maxWidth: '900px' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Integraciones</h1>
          <p className="page-subtitle">
            Conecta tus canales para captar y atender leads automáticamente
          </p>
        </div>
      </div>

      <IntegrationsClient
        tenantId={tenant.tenantId}
        tenantSlug={tenantSlug}
        whatsappInstance={whatsappInstance}
      />
    </div>
  )
}
