'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { SearchInput } from '@/components/search-input'
import {
  IconBath,
  IconBed,
  IconBuilding,
  IconGrid,
  IconImage,
  IconMapPin,
  IconPencil,
  IconPlus,
  IconRuler,
  IconTable,
} from '@/components/icons'
import { STATUS_LABELS, statusBadge, type Property } from './property-types'

interface PropertiesViewProps {
  tenantSlug: string
  tenantId: string
  initialProperties: Property[]
}

type ViewMode = 'cards' | 'table'

const VIEW_STORAGE_KEY = 'imno.properties.view'

/**
 * Interactive properties catalogue: debounced search across title, reference,
 * zone and description, plus a card / table view toggle.
 */
export function PropertiesView({ tenantSlug, tenantId, initialProperties }: PropertiesViewProps) {
  const [properties, setProperties] = useState<Property[]>(initialProperties)
  const [view, setView] = useState<ViewMode>('cards')
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const stored = window.localStorage.getItem(VIEW_STORAGE_KEY)
    if (stored === 'cards' || stored === 'table') setView(stored)
  }, [])

  function selectView(next: ViewMode) {
    setView(next)
    window.localStorage.setItem(VIEW_STORAGE_KEY, next)
  }

  const handleSearch = useCallback(
    async (nextQuery: string) => {
      setQuery(nextQuery)
      setSearching(true)
      setError(null)

      try {
        const params = new URLSearchParams({ tenantId, limit: '100' })
        if (nextQuery) params.set('search', nextQuery)

        const response = await fetch(`/api/properties?${params.toString()}`)
        const data = await response.json()
        if (!response.ok) throw new Error(data?.message || 'No se pudo buscar')

        setProperties((data.docs ?? []) as Property[])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'No se pudo buscar')
      } finally {
        setSearching(false)
      }
    },
    [tenantId],
  )

  const toolbar = (
    <div className="list-toolbar">
      <div className="list-toolbar-search">
        <SearchInput
          placeholder="Buscar por título, referencia o zona..."
          onSearch={handleSearch}
          loading={searching}
        />
      </div>
      <div className="view-toggle" role="group" aria-label="Modo de vista">
        <button
          type="button"
          className={`view-toggle-btn${view === 'cards' ? ' is-active' : ''}`}
          onClick={() => selectView('cards')}
          aria-pressed={view === 'cards'}
        >
          <IconGrid width={16} height={16} /> Tarjetas
        </button>
        <button
          type="button"
          className={`view-toggle-btn${view === 'table' ? ' is-active' : ''}`}
          onClick={() => selectView('table')}
          aria-pressed={view === 'table'}
        >
          <IconTable width={16} height={16} /> Tabla
        </button>
      </div>
    </div>
  )

  return (
    <>
      {toolbar}

      {error && (
        <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
          {error}
        </div>
      )}

      {properties.length === 0 ? (
        <div className="empty-state">
          <span className="empty-state-icon">
            <IconBuilding />
          </span>
          <h3>{query ? 'Sin resultados' : 'Sin propiedades todavía'}</h3>
          <p className="page-subtitle" style={{ marginTop: 0 }}>
            {query
              ? `Ninguna propiedad coincide con "${query}".`
              : 'Añade tu primer inmueble para empezar.'}
          </p>
          {!query && (
            <Link
              href={`/app/${tenantSlug}/properties/new`}
              className="btn btn-primary"
              style={{ marginTop: '0.75rem' }}
            >
              <IconPlus width={18} height={18} />
              Añadir propiedad
            </Link>
          )}
        </div>
      ) : view === 'cards' ? (
        <div className="grid-auto">
          {properties.map((property) => (
            <div key={property.id} className="card card-hover property-card">
              <Link
                href={`/app/${tenantSlug}/properties/${property.id}`}
                className="property-card-link"
              >
                {property.mainImage ? (
                  <div
                    className="property-card-media"
                    style={{ backgroundImage: `url(${property.mainImage.url})` }}
                  />
                ) : (
                  <div className="property-card-media is-empty">
                    <IconImage width={28} height={28} />
                  </div>
                )}

                <div className="property-card-body">
                  <div className="property-card-head">
                    <div style={{ minWidth: 0 }}>
                      <h3 className="property-card-title">{property.title}</h3>
                      <p className="property-card-reference">{property.reference}</p>
                    </div>
                    <span className={`badge ${statusBadge(property.status)}`}>
                      {STATUS_LABELS[property.status]}
                    </span>
                  </div>

                  <p className="property-card-price">
                    {property.price.toLocaleString()} {property.currency}
                  </p>

                  <div className="property-card-specs">
                    {property.bedrooms != null && (
                      <span className="property-card-spec">
                        <IconBed width={16} height={16} /> {property.bedrooms}
                      </span>
                    )}
                    {property.bathrooms != null && (
                      <span className="property-card-spec">
                        <IconBath width={16} height={16} /> {property.bathrooms}
                      </span>
                    )}
                    {property.areaSqm != null && (
                      <span className="property-card-spec">
                        <IconRuler width={16} height={16} /> {property.areaSqm} m²
                      </span>
                    )}
                  </div>

                  <p className="property-card-zone">
                    <IconMapPin width={16} height={16} /> {property.zone}
                  </p>
                </div>
              </Link>

              <div className="property-card-actions">
                <Link
                  href={`/app/${tenantSlug}/properties/${property.id}`}
                  className="btn btn-secondary btn-sm"
                >
                  Ver
                </Link>
                <Link
                  href={`/app/${tenantSlug}/properties/${property.id}/edit`}
                  className="btn btn-secondary btn-sm"
                >
                  <IconPencil width={14} height={14} /> Editar
                </Link>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="table-container">
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>Título</th>
                  <th>Referencia</th>
                  <th>Zona</th>
                  <th>Precio</th>
                  <th>Hab.</th>
                  <th>Baños</th>
                  <th>m²</th>
                  <th>Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {properties.map((property) => (
                  <tr key={property.id}>
                    <td>
                      <Link href={`/app/${tenantSlug}/properties/${property.id}`} className="link">
                        {property.title}
                      </Link>
                    </td>
                    <td>{property.reference}</td>
                    <td>{property.zone}</td>
                    <td>
                      {property.price.toLocaleString()} {property.currency}
                    </td>
                    <td>{property.bedrooms ?? '—'}</td>
                    <td>{property.bathrooms ?? '—'}</td>
                    <td>{property.areaSqm ?? '—'}</td>
                    <td>
                      <span className={`badge ${statusBadge(property.status)}`}>
                        {STATUS_LABELS[property.status]}
                      </span>
                    </td>
                    <td>
                      <div className="row-actions">
                        <Link
                          href={`/app/${tenantSlug}/properties/${property.id}`}
                          className="btn btn-secondary btn-sm"
                        >
                          Ver
                        </Link>
                        <Link
                          href={`/app/${tenantSlug}/properties/${property.id}/edit`}
                          className="btn btn-secondary btn-sm"
                        >
                          <IconPencil width={14} height={14} /> Editar
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  )
}
