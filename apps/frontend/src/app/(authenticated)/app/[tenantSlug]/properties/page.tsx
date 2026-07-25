import { redirect } from 'next/navigation'
import Link from 'next/link'
import { resolveTenant, authFetch } from '@/lib/auth'
import { getApiUrl } from '@/lib/config'
import { IconPlus } from '@/components/icons'
import { PropertiesView } from './properties-view'
import type { Property } from './property-types'

interface PropertiesResponse {
  docs: Property[]
  totalDocs: number
}

async function getProperties(tenantId: string): Promise<Property[]> {
  const apiUrl = getApiUrl()
  const response = await authFetch(
    `${apiUrl}/api/properties?where[tenant][equals]=${tenantId}&limit=100&depth=1&sort=-createdAt`,
  )

  if (!response.ok) {
    return []
  }

  const data: PropertiesResponse = await response.json()
  return data.docs
}

export default async function PropertiesPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>
}) {
  const { tenantSlug } = await params
  const tenant = await resolveTenant(tenantSlug)

  if (!tenant) {
    redirect('/login')
  }

  const properties = await getProperties(tenant.tenantId)

  return (
    <div className="container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Propiedades</h1>
          <p className="page-subtitle">Gestiona tu catálogo de inmuebles</p>
        </div>
        <Link href={`/app/${tenantSlug}/properties/new`} className="btn btn-primary">
          <IconPlus width={18} height={18} />
          Añadir propiedad
        </Link>
      </div>

      <PropertiesView
        tenantSlug={tenantSlug}
        tenantId={tenant.tenantId}
        initialProperties={properties}
      />
    </div>
  )
}
