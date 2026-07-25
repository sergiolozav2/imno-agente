import { redirect } from 'next/navigation'
import Link from 'next/link'
import { resolveTenant, authFetch } from '@/lib/auth'
import { getApiUrl } from '@/lib/config'
import { IconPlus } from '@/components/icons'
import { ClientsView } from './clients-view'
import type { BuyerClient } from './client-types'

interface ClientsResponse {
  docs: BuyerClient[]
  totalDocs: number
}

async function getClients(tenantId: string): Promise<BuyerClient[]> {
  const apiUrl = getApiUrl()
  const response = await authFetch(
    `${apiUrl}/api/buyer-clients?where[tenant][equals]=${tenantId}&limit=100&sort=-createdAt`,
  )

  if (!response.ok) return []

  const data: ClientsResponse = await response.json()
  return data.docs
}

export default async function ClientsPage({ params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = await params
  const tenant = await resolveTenant(tenantSlug)

  if (!tenant) {
    redirect('/login')
  }

  const clients = await getClients(tenant.tenantId)

  return (
    <div className="container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Clientes</h1>
          <p className="page-subtitle">Gestiona tus leads y contactos</p>
        </div>
        <Link href={`/app/${tenantSlug}/clients/new`} className="btn btn-primary">
          <IconPlus width={18} height={18} />
          Añadir cliente
        </Link>
      </div>

      <ClientsView tenantSlug={tenantSlug} tenantId={tenant.tenantId} initialClients={clients} />
    </div>
  )
}
