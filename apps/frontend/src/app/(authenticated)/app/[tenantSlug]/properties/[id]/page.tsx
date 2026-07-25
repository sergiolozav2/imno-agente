import { redirect } from 'next/navigation'
import Link from 'next/link'
import { resolveTenant, authFetch } from '@/lib/auth'
import { getApiUrl } from '@/lib/config'
import {
  IconArrowLeft,
  IconCube,
  IconSparkles,
  IconInbox,
  IconImage,
  IconPencil,
} from '@/components/icons'
import { PRICING_UNIT_LABELS, STATUS_LABELS, statusBadge, type Property } from '../property-types'

interface ZonalPrice {
  id: string
  amount: number
  currency: string
  pricingUnit: string
}

async function getProperty(id: string): Promise<Property | null> {
  const apiUrl = getApiUrl()
  const response = await authFetch(`${apiUrl}/api/properties/${id}?depth=2`)

  if (!response.ok) {
    return null
  }

  return response.json()
}

async function getZonalPrice(tenantId: string, zone: string): Promise<ZonalPrice | null> {
  const apiUrl = getApiUrl()
  const response = await authFetch(
    `${apiUrl}/api/zonal-prices?where[tenant][equals]=${tenantId}&where[zone][equals]=${encodeURIComponent(zone)}&where[pricingUnit][equals]=total&limit=1`,
  )

  if (!response.ok) {
    return null
  }

  const data = await response.json()
  return data.docs?.[0] || null
}

export default async function PropertyDetailPage({
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

  const zonalPrice = await getZonalPrice(tenant.tenantId, property.zone)

  const pricingLabel =
    property.pricingUnit === 'total' ? 'Precio total' : PRICING_UNIT_LABELS[property.pricingUnit]

  return (
    <div className="container">
      <Link href={`/app/${tenantSlug}/properties`} className="breadcrumb">
        <IconArrowLeft width={16} height={16} /> Volver a propiedades
      </Link>

      <div className="page-header">
        <div>
          <h1 className="page-title">{property.title}</h1>
          <p className="page-subtitle">
            {property.reference} · {property.zone}
          </p>
        </div>
        <Link href={`/app/${tenantSlug}/properties/${id}/edit`} className="btn btn-secondary">
          <IconPencil width={16} height={16} /> Editar
        </Link>
      </div>

      <div className="grid-2" style={{ gap: '1.5rem' }}>
        {/* Left column: Images and 3D model */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="card card-flush">
            {property.model3d ? (
              <ModelViewer src={property.model3d.url} fallbackImage={property.mainImage?.url} />
            ) : property.mainImage ? (
              <img
                src={property.mainImage.url}
                alt={property.title}
                style={{ width: '100%', height: '400px', objectFit: 'cover', display: 'block' }}
              />
            ) : (
              <div
                style={{
                  height: '400px',
                  background: 'var(--color-surface-2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--color-text-subtle)',
                }}
              >
                <IconImage width={32} height={32} />
              </div>
            )}
          </div>

          {property.images && property.images.length > 0 && (
            <div
              style={{
                display: 'flex',
                gap: '0.5rem',
                overflowX: 'auto',
                paddingBottom: '0.25rem',
              }}
            >
              {property.images.map((img) => (
                <img
                  key={img.id}
                  src={img.url}
                  alt={img.filename}
                  style={{
                    width: '96px',
                    height: '96px',
                    objectFit: 'cover',
                    borderRadius: 'var(--radius-md)',
                    border:
                      img.id === property.mainImage?.id
                        ? '2px solid var(--color-primary)'
                        : '1px solid var(--color-border)',
                    flexShrink: 0,
                  }}
                />
              ))}
            </div>
          )}

          {property.model3d && (
            <div className="alert alert-info">
              <IconCube width={18} height={18} style={{ flexShrink: 0 }} />
              <span>Arrastra para rotar y usa la rueda para hacer zoom en el modelo 3D.</span>
            </div>
          )}
        </div>

        {/* Right column: Details */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="card">
            <span className={`badge ${statusBadge(property.status)}`}>
              {STATUS_LABELS[property.status]}
            </span>
            <h2 style={{ fontSize: '2rem', marginTop: '0.625rem', letterSpacing: '-0.02em' }}>
              {property.price.toLocaleString()} {property.currency}
            </h2>
            <p className="page-subtitle" style={{ marginTop: '0.125rem' }}>
              {pricingLabel}
            </p>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '0.75rem',
                marginTop: '1.5rem',
              }}
            >
              {property.bedrooms != null && <Spec value={property.bedrooms} label="Dormitorios" />}
              {property.bathrooms != null && <Spec value={property.bathrooms} label="Baños" />}
              {property.areaSqm != null && <Spec value={property.areaSqm} label="m²" />}
            </div>
          </div>

          <div className="card">
            <h3 className="card-title" style={{ marginBottom: '0.5rem' }}>
              Precio zonal
            </h3>
            <p className="page-subtitle" style={{ marginTop: 0, marginBottom: '0.5rem' }}>
              Zona: <strong style={{ color: 'var(--color-text)' }}>{property.zone}</strong>
            </p>
            {zonalPrice ? (
              <p style={{ fontSize: '1.125rem', fontWeight: 600 }}>
                {zonalPrice.amount.toLocaleString()} {zonalPrice.currency}
                <span
                  style={{
                    color: 'var(--color-text-muted)',
                    fontSize: '0.8125rem',
                    marginLeft: '0.5rem',
                    fontWeight: 400,
                  }}
                >
                  (referencia zonal)
                </span>
              </p>
            ) : (
              <p style={{ color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                Precio zonal no disponible
              </p>
            )}
          </div>

          {property.description && (
            <div className="card">
              <h3 className="card-title" style={{ marginBottom: '0.75rem' }}>
                Descripción
              </h3>
              <p style={{ lineHeight: 1.7, whiteSpace: 'pre-wrap', color: 'var(--color-ink-700)' }}>
                {property.description}
              </p>
            </div>
          )}

          <div className="card">
            <h3 className="card-title" style={{ marginBottom: '0.75rem' }}>
              Acciones rápidas
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <Link
                href={`/app/${tenantSlug}/content?propertyId=${property.id}`}
                className="btn btn-secondary btn-sm"
              >
                <IconSparkles width={16} height={16} /> Generar contenido
              </Link>
              <Link
                href={`/app/${tenantSlug}/conversations?propertyId=${property.id}`}
                className="btn btn-secondary btn-sm"
              >
                <IconInbox width={16} height={16} /> Ver consultas
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Spec({ value, label }: { value: number; label: string }) {
  return (
    <div
      style={{
        textAlign: 'center',
        background: 'var(--color-surface-2)',
        borderRadius: 'var(--radius-md)',
        padding: '0.75rem 0.5rem',
      }}
    >
      <p style={{ fontSize: '1.375rem', fontWeight: 680 }}>{value}</p>
      <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{label}</p>
    </div>
  )
}

function ModelViewer({ src, fallbackImage }: { src: string; fallbackImage?: string }) {
  const viewerHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <script type="module" src="https://ajax.googleapis.com/ajax/libs/model-viewer/3.3.0/model-viewer.min.js"></script>
      <style>
        body { margin: 0; padding: 0; }
        model-viewer { width: 100%; height: 400px; background: #f9fafb; }
      </style>
    </head>
    <body>
      <model-viewer
        src="${src}"
        alt="Modelo 3D"
        auto-rotate
        camera-controls
        touch-action="pan-y"
      >
        ${
          fallbackImage
            ? `<div slot="poster" style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:#f9fafb;">
          <img src="${fallbackImage}" alt="Propiedad" style="max-width:100%;max-height:100%;object-fit:contain;" />
        </div>`
            : ''
        }
      </model-viewer>
    </body>
    </html>
  `

  return (
    <iframe
      srcDoc={viewerHtml}
      style={{ width: '100%', height: '400px', border: 'none', display: 'block' }}
      title="Visor de modelo 3D"
    />
  )
}
