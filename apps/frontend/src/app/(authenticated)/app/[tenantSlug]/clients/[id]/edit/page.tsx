import { redirect } from 'next/navigation'
import Link from 'next/link'
import { resolveTenant, authFetch } from '@/lib/auth'
import { getApiUrl } from '@/lib/config'
import { IconArrowLeft } from '@/components/icons'
import { ClientForm } from '../../client-form'
import type { BuyerClient } from '../../client-types'

async function getClient(id: string): Promise<BuyerClient | null> {
  const apiUrl = getApiUrl()
  const response = await authFetch(`${apiUrl}/api/buyer-clients/${id}?depth=0`)

  if (!response.ok) return null

  return response.json()
}

export default async function EditClientPage({
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

  return (
    <div className="container" style={{ maxWidth: '640px' }}>
      <Link href={`/app/${tenantSlug}/clients/${id}`} className="breadcrumb">
        <IconArrowLeft width={16} height={16} /> Volver al cliente
      </Link>

      <div className="page-header">
        <div>
          <h1 className="page-title">Editar cliente</h1>
          <p className="page-subtitle">Actualiza los datos de {client.name}</p>
        </div>
      </div>

      <div className="card">
        <ClientForm tenantSlug={tenantSlug} tenantId={tenant.tenantId} client={client} />
      </div>
    </div>
  )
}
