import { redirect } from 'next/navigation'
import Link from 'next/link'
import { resolveTenant } from '@/lib/auth'
import { authFetch } from '@/lib/auth'
import { getApiUrl } from '@/lib/config'
import {
  IconPlus,
  IconBed,
  IconBath,
  IconRuler,
  IconMapPin,
  IconBuilding,
  IconImage,
} from '@/components/icons'

interface Property {
  id: string
  reference: string
  title: string
  price: number
  currency: string
  zone: string
  status: 'available' | 'reserved' | 'sold'
  bedrooms?: number
  bathrooms?: number
  areaSqm?: number
  mainImage?: {
    id: string
    url: string
    filename: string
  }
}

interface PropertiesResponse {
  docs: Property[]
  totalDocs: number
}

const STATUS_LABELS: Record<Property['status'], string> = {
  available: 'Disponible',
  reserved: 'Reservada',
  sold: 'Vendida',
}

function statusBadge(status: Property['status']) {
  return status === 'available'
    ? 'badge-success'
    : status === 'reserved'
      ? 'badge-warning'
      : 'badge-error'
}

async function getProperties(tenantId: string): Promise<Property[]> {
  const apiUrl = getApiUrl()
  const response = await authFetch(
    `${apiUrl}/api/properties?where[tenant][equals]=${tenantId}&limit=50&depth=1`,
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

      {properties.length === 0 ? (
        <div className="empty-state">
          <span className="empty-state-icon">
            <IconBuilding />
          </span>
          <h3>Sin propiedades todavía</h3>
          <p className="page-subtitle" style={{ marginTop: 0 }}>
            Añade tu primer inmueble para empezar.
          </p>
          <Link
            href={`/app/${tenantSlug}/properties/new`}
            className="btn btn-primary"
            style={{ marginTop: '0.75rem' }}
          >
            <IconPlus width={18} height={18} />
            Añadir propiedad
          </Link>
        </div>
      ) : (
        <div className="grid-auto">
          {properties.map((property) => (
            <Link
              key={property.id}
              href={`/app/${tenantSlug}/properties/${property.id}`}
              className="card card-hover card-flush"
              style={{ display: 'flex', flexDirection: 'column' }}
            >
              {property.mainImage ? (
                <div
                  style={{
                    height: '180px',
                    background: `url(${property.mainImage.url}) center/cover`,
                  }}
                />
              ) : (
                <div
                  style={{
                    height: '180px',
                    background: 'var(--color-surface-2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--color-text-subtle)',
                  }}
                >
                  <IconImage width={28} height={28} />
                </div>
              )}

              <div
                style={{
                  padding: '1.125rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.625rem',
                  flex: 1,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: '0.75rem',
                    alignItems: 'flex-start',
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <h3
                      style={{
                        fontSize: '0.9375rem',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {property.title}
                    </h3>
                    <p
                      style={{
                        color: 'var(--color-text-muted)',
                        fontSize: '0.75rem',
                        marginTop: '0.125rem',
                      }}
                    >
                      {property.reference}
                    </p>
                  </div>
                  <span className={`badge ${statusBadge(property.status)}`}>
                    {STATUS_LABELS[property.status]}
                  </span>
                </div>

                <p style={{ fontSize: '1.25rem', fontWeight: 680, letterSpacing: '-0.02em' }}>
                  {property.price.toLocaleString()} {property.currency}
                </p>

                <div
                  style={{
                    display: 'flex',
                    gap: '1rem',
                    color: 'var(--color-text-muted)',
                    fontSize: '0.8125rem',
                    marginTop: 'auto',
                  }}
                >
                  {property.bedrooms != null && (
                    <span
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3125rem' }}
                    >
                      <IconBed width={16} height={16} /> {property.bedrooms}
                    </span>
                  )}
                  {property.bathrooms != null && (
                    <span
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3125rem' }}
                    >
                      <IconBath width={16} height={16} /> {property.bathrooms}
                    </span>
                  )}
                  {property.areaSqm != null && (
                    <span
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3125rem' }}
                    >
                      <IconRuler width={16} height={16} /> {property.areaSqm} m²
                    </span>
                  )}
                </div>

                <p
                  style={{
                    color: 'var(--color-text-muted)',
                    fontSize: '0.8125rem',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.3125rem',
                  }}
                >
                  <IconMapPin width={16} height={16} /> {property.zone}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
