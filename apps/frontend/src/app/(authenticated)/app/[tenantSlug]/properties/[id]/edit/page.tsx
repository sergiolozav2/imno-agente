import { redirect } from 'next/navigation'
import Link from 'next/link'
import { resolveTenant, authFetch } from '@/lib/auth'
import { getApiUrl } from '@/lib/config'
import { IconArrowLeft } from '@/components/icons'
import { PropertyForm } from '../../property-form'
import type { Property } from '../../property-types'

async function getProperty(id: string): Promise<Property | null> {
  const apiUrl = getApiUrl()
  const response = await authFetch(`${apiUrl}/api/properties/${id}?depth=1`)

  if (!response.ok) return null

  return response.json()
}

export default async function EditPropertyPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; id: string }>
}) {
  const { tenantSlug, id } = await params
  const tenant = await resolveTenant(tenantSlug)

  if (!tenant) {
    redirect('/login')
  }

  const property = await getProperty(id)

  if (!property) {
    return (
      <div className="container">
        <div className="alert alert-error">Propiedad no encontrada</div>
        <Link
          href={`/app/${tenantSlug}/properties`}
          className="btn btn-secondary"
          style={{ marginTop: '1rem' }}
        >
          <IconArrowLeft width={18} height={18} /> Volver a propiedades
        </Link>
      </div>
    )
  }

  return (
    <div className="container">
      <Link href={`/app/${tenantSlug}/properties/${id}`} className="breadcrumb">
        <IconArrowLeft width={16} height={16} /> Volver a la propiedad
      </Link>

      <div className="page-header">
        <div>
          <h1 className="page-title">Editar propiedad</h1>
          <p className="page-subtitle">
            {property.reference} · {property.title}
          </p>
        </div>
      </div>

      <PropertyForm tenantSlug={tenantSlug} tenantId={tenant.tenantId} property={property} />
    </div>
  )
}
