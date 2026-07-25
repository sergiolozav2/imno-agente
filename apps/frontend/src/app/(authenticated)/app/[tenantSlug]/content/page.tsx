import { redirect } from 'next/navigation'
import Link from 'next/link'
import { resolveTenant, authFetch } from '@/lib/auth'
import { getApiUrl } from '@/lib/config'
import { IconImage } from '@/components/icons'
import { ContentGenerator } from './content-client'

interface Property {
  id: string
  reference: string
  title: string
  description?: string
  price: number
  currency: string
  mainImage?: { id: string; url: string }
}

async function getProperties(tenantId: string): Promise<Property[]> {
  const apiUrl = getApiUrl()
  const response = await authFetch(
    `${apiUrl}/api/properties?where[tenant][equals]=${tenantId}&limit=50&depth=1`,
  )
  if (!response.ok) return []
  const data = await response.json()
  return data.docs || []
}

export default async function ContentPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantSlug: string }>
  searchParams: Promise<{ propertyId?: string }>
}) {
  const { tenantSlug } = await params
  const { propertyId } = await searchParams
  const tenant = await resolveTenant(tenantSlug)

  if (!tenant) {
    redirect('/login')
  }

  const properties = await getProperties(tenant.tenantId)
  const selectedProperty = propertyId ? properties.find((p) => p.id === propertyId) : properties[0]

  return (
    <div className="container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Generación de contenido</h1>
          <p className="page-subtitle">Genera textos para redes y vídeos de propiedades</p>
        </div>
      </div>

      <div className="grid-2" style={{ gap: '1.5rem', alignItems: 'start' }}>
        <div className="card">
          <h3 className="card-title" style={{ marginBottom: '1rem' }}>
            Selecciona una propiedad
          </h3>

          {properties.length === 0 ? (
            <p className="page-subtitle" style={{ marginTop: 0 }}>
              No hay propiedades disponibles.{' '}
              <Link href={`/app/${tenantSlug}/properties/new`} className="link">
                Añade una primero
              </Link>
              .
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {properties.map((property) => {
                const isSelected = selectedProperty?.id === property.id
                return (
                  <Link
                    key={property.id}
                    href={`/app/${tenantSlug}/content?propertyId=${property.id}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.875rem',
                      padding: '0.625rem',
                      borderRadius: 'var(--radius-md)',
                      border: isSelected
                        ? '2px solid var(--color-primary)'
                        : '1px solid var(--color-border)',
                      textDecoration: 'none',
                      color: 'inherit',
                      background: isSelected ? 'var(--color-primary-soft)' : 'transparent',
                    }}
                  >
                    {property.mainImage ? (
                      <img
                        src={property.mainImage.url}
                        alt={property.title}
                        style={{
                          width: '56px',
                          height: '56px',
                          objectFit: 'cover',
                          borderRadius: 'var(--radius-sm)',
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: '56px',
                          height: '56px',
                          background: 'var(--color-surface-2)',
                          borderRadius: 'var(--radius-sm)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'var(--color-text-subtle)',
                          flexShrink: 0,
                        }}
                      >
                        <IconImage width={20} height={20} />
                      </div>
                    )}
                    <div style={{ minWidth: 0 }}>
                      <p
                        style={{
                          fontWeight: 550,
                          fontSize: '0.875rem',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {property.title}
                      </p>
                      <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                        {property.reference} · {property.price.toLocaleString()} {property.currency}
                      </p>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>

        <div>
          {selectedProperty ? (
            <ContentGenerator tenantId={tenant.tenantId} property={selectedProperty} />
          ) : (
            <div className="empty-state">
              <p className="page-subtitle" style={{ marginTop: 0 }}>
                Selecciona una propiedad para generar contenido
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
