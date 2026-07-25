'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { IconUpload } from '@/components/icons'
import {
  PRICING_UNITS,
  PRICING_UNIT_LABELS,
  PROPERTY_STATUSES,
  STATUS_LABELS,
  type MediaAsset,
  type PricingUnit,
  type Property,
  type PropertyStatus,
} from './property-types'

interface PropertyFormState {
  reference: string
  title: string
  description: string
  price: string
  currency: string
  zone: string
  pricingUnit: PricingUnit
  status: PropertyStatus
  bedrooms: string
  bathrooms: string
  areaSqm: string
  images: string[]
  mainImage: string
  model3d: string
}

interface PropertyFormProps {
  tenantSlug: string
  tenantId: string
  /** Present when editing; omit to create a new property. */
  property?: Property
}

function initialState(property?: Property): PropertyFormState {
  return {
    reference: property?.reference ?? '',
    title: property?.title ?? '',
    description: property?.description ?? '',
    price: property?.price != null ? String(property.price) : '',
    currency: property?.currency ?? 'EUR',
    zone: property?.zone ?? '',
    pricingUnit: property?.pricingUnit ?? 'total',
    status: property?.status ?? 'available',
    bedrooms: property?.bedrooms != null ? String(property.bedrooms) : '',
    bathrooms: property?.bathrooms != null ? String(property.bathrooms) : '',
    areaSqm: property?.areaSqm != null ? String(property.areaSqm) : '',
    images: property?.images?.map((image) => String(image.id)) ?? [],
    mainImage: property?.mainImage ? String(property.mainImage.id) : '',
    model3d: property?.model3d ? String(property.model3d.id) : '',
  }
}

/**
 * Create / edit form for a property. Both modes land on the property's
 * detail page once the save succeeds.
 */
export function PropertyForm({ tenantSlug, tenantId, property }: PropertyFormProps) {
  const router = useRouter()
  const isEdit = Boolean(property)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mediaAssets, setMediaAssets] = useState<MediaAsset[]>([])
  const [uploading, setUploading] = useState(false)

  const [formData, setFormData] = useState<PropertyFormState>(() => initialState(property))

  const cancelHref = isEdit
    ? `/app/${tenantSlug}/properties/${property!.id}`
    : `/app/${tenantSlug}/properties`

  useEffect(() => {
    async function loadMedia() {
      try {
        const response = await fetch(`/api/media-assets?tenantId=${tenantId}&kind=image`)
        const data = await response.json()
        setMediaAssets(data.docs || [])
      } catch {
        // Ignore errors
      }
    }
    loadMedia()
  }, [tenantId])

  async function handleFileUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    setUploading(true)
    setError(null)

    try {
      const formDataUpload = new FormData()
      formDataUpload.append('file', file)
      formDataUpload.append('tenant', tenantId)
      formDataUpload.append('kind', 'image')

      const response = await fetch('/api/media-assets', {
        method: 'POST',
        body: formDataUpload,
      })

      if (!response.ok) {
        throw new Error('No se pudo subir la imagen')
      }

      const newAsset = await response.json()
      setMediaAssets((prev) => [...prev, newAsset.doc])

      setFormData((prev) => ({
        ...prev,
        images: [...prev.images, newAsset.doc.id],
        mainImage: prev.images.length === 0 ? newAsset.doc.id : prev.mainImage,
      }))
    } catch {
      setError('No se pudo subir la imagen')
    } finally {
      setUploading(false)
    }
  }

  function toggleImageSelection(imageId: string) {
    setFormData((prev) => {
      const isSelected = prev.images.includes(imageId)
      const newImages = isSelected
        ? prev.images.filter((id) => id !== imageId)
        : [...prev.images, imageId]

      let newMainImage = prev.mainImage
      if (isSelected && prev.mainImage === imageId) {
        newMainImage = newImages[0] || ''
      } else if (!isSelected && newImages.length === 1) {
        newMainImage = imageId
      }

      return {
        ...prev,
        images: newImages,
        mainImage: newMainImage,
      }
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      if (formData.images.length > 0 && !formData.mainImage) {
        throw new Error('Selecciona una imagen principal')
      }

      // Payload clears a field when it receives null, so edits send null
      // where creates simply omit the key.
      const empty = isEdit ? null : undefined

      const payload = {
        ...(isEdit ? {} : { tenant: tenantId }),
        reference: formData.reference,
        title: formData.title,
        description: formData.description || empty,
        price: parseFloat(formData.price),
        currency: formData.currency,
        zone: formData.zone,
        pricingUnit: formData.pricingUnit,
        status: formData.status,
        bedrooms: formData.bedrooms ? parseInt(formData.bedrooms) : empty,
        bathrooms: formData.bathrooms ? parseInt(formData.bathrooms) : empty,
        areaSqm: formData.areaSqm ? parseFloat(formData.areaSqm) : empty,
        images: formData.images.length > 0 ? formData.images : empty,
        mainImage: formData.mainImage || empty,
        model3d: formData.model3d || empty,
      }

      const response = await fetch(isEdit ? `/api/properties/${property!.id}` : '/api/properties', {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(data?.errors?.[0]?.message || data?.message || 'No se pudo guardar')
      }

      const id = isEdit ? property!.id : data?.doc?.id
      router.push(`/app/${tenantSlug}/properties/${id}`)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar')
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      {error && (
        <div className="alert alert-error" style={{ marginBottom: '1.25rem' }}>
          {error}
        </div>
      )}

      <div className="grid-2" style={{ gap: '1.5rem', alignItems: 'start' }}>
        {/* Left column: Basic info */}
        <div className="card">
          <h3 className="card-title" style={{ marginBottom: '1.25rem' }}>
            Información básica
          </h3>

          <div className="form-group">
            <label className="form-label" htmlFor="property-reference">
              Referencia *
            </label>
            <input
              id="property-reference"
              type="text"
              className="form-input"
              value={formData.reference}
              onChange={(e) => setFormData((prev) => ({ ...prev, reference: e.target.value }))}
              placeholder="PROP-001"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="property-title">
              Título *
            </label>
            <input
              id="property-title"
              type="text"
              className="form-input"
              value={formData.title}
              onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
              placeholder="Apartamento en el centro de la ciudad"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="property-description">
              Descripción
            </label>
            <textarea
              id="property-description"
              className="form-textarea"
              value={formData.description}
              onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
              placeholder="Describe la propiedad..."
              rows={4}
            />
          </div>

          <div className="grid-2" style={{ gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label" htmlFor="property-price">
                Precio *
              </label>
              <input
                id="property-price"
                type="number"
                className="form-input"
                value={formData.price}
                onChange={(e) => setFormData((prev) => ({ ...prev, price: e.target.value }))}
                placeholder="250000"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="property-currency">
                Moneda
              </label>
              <select
                id="property-currency"
                className="form-select"
                value={formData.currency}
                onChange={(e) => setFormData((prev) => ({ ...prev, currency: e.target.value }))}
              >
                <option value="EUR">EUR</option>
                <option value="USD">USD</option>
                <option value="GBP">GBP</option>
              </select>
            </div>
          </div>

          <div className="grid-2" style={{ gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label" htmlFor="property-zone">
                Zona *
              </label>
              <input
                id="property-zone"
                type="text"
                className="form-input"
                value={formData.zone}
                onChange={(e) => setFormData((prev) => ({ ...prev, zone: e.target.value }))}
                placeholder="Centro"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="property-pricing-unit">
                Unidad de precio
              </label>
              <select
                id="property-pricing-unit"
                className="form-select"
                value={formData.pricingUnit}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    pricingUnit: e.target.value as PricingUnit,
                  }))
                }
              >
                {PRICING_UNITS.map((unit) => (
                  <option key={unit} value={unit}>
                    {PRICING_UNIT_LABELS[unit]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" htmlFor="property-status">
              Estado
            </label>
            <select
              id="property-status"
              className="form-select"
              value={formData.status}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, status: e.target.value as PropertyStatus }))
              }
            >
              {PROPERTY_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {STATUS_LABELS[status]}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Right column: Details and images */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="card">
            <h3 className="card-title" style={{ marginBottom: '1.25rem' }}>
              Detalles
            </h3>

            <div className="grid-3" style={{ gap: '1rem' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" htmlFor="property-bedrooms">
                  Dormitorios
                </label>
                <input
                  id="property-bedrooms"
                  type="number"
                  className="form-input"
                  value={formData.bedrooms}
                  onChange={(e) => setFormData((prev) => ({ ...prev, bedrooms: e.target.value }))}
                  placeholder="3"
                  min="0"
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" htmlFor="property-bathrooms">
                  Baños
                </label>
                <input
                  id="property-bathrooms"
                  type="number"
                  className="form-input"
                  value={formData.bathrooms}
                  onChange={(e) => setFormData((prev) => ({ ...prev, bathrooms: e.target.value }))}
                  placeholder="2"
                  min="0"
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" htmlFor="property-area">
                  Área (m²)
                </label>
                <input
                  id="property-area"
                  type="number"
                  className="form-input"
                  value={formData.areaSqm}
                  onChange={(e) => setFormData((prev) => ({ ...prev, areaSqm: e.target.value }))}
                  placeholder="120"
                  min="0"
                  step="0.1"
                />
              </div>
            </div>
          </div>

          <div className="card">
            <h3 className="card-title" style={{ marginBottom: '1rem' }}>
              Imágenes
            </h3>

            <label
              className="btn btn-secondary btn-sm"
              style={{ cursor: 'pointer', marginBottom: '1rem' }}
            >
              {uploading ? (
                <>
                  <span className="spinner" /> Subiendo...
                </>
              ) : (
                <>
                  <IconUpload width={16} height={16} /> Subir imagen
                </>
              )}
              <input
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                style={{ display: 'none' }}
                disabled={uploading}
              />
            </label>

            {mediaAssets.length > 0 && (
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {mediaAssets.map((asset) => {
                  const isSelected = formData.images.includes(String(asset.id))
                  const isMain = formData.mainImage === String(asset.id)
                  return (
                    <button
                      type="button"
                      key={asset.id}
                      onClick={() => toggleImageSelection(String(asset.id))}
                      style={{
                        position: 'relative',
                        cursor: 'pointer',
                        borderRadius: 'var(--radius-md)',
                        border: isMain
                          ? '2px solid var(--color-primary)'
                          : isSelected
                            ? '2px solid var(--color-brand-400)'
                            : '1px solid var(--color-border)',
                        overflow: 'hidden',
                        padding: 0,
                        background: 'none',
                        lineHeight: 0,
                      }}
                    >
                      <img
                        src={asset.url}
                        alt={asset.filename}
                        style={{ width: '84px', height: '84px', objectFit: 'cover' }}
                      />
                      {isMain && (
                        <span
                          style={{
                            position: 'absolute',
                            bottom: 0,
                            left: 0,
                            right: 0,
                            background: 'var(--color-primary)',
                            color: 'white',
                            fontSize: '0.5625rem',
                            fontWeight: 600,
                            letterSpacing: '0.05em',
                            textAlign: 'center',
                            padding: '0.1875rem',
                          }}
                        >
                          PRINCIPAL
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            )}

            {formData.images.length > 0 && (
              <p className="form-hint">
                {formData.images.length} imagen(es) seleccionada(s). Haz clic para alternar. La
                principal aparece en verde.
              </p>
            )}
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? (
                <>
                  <span className="spinner" /> Guardando...
                </>
              ) : isEdit ? (
                'Guardar cambios'
              ) : (
                'Crear propiedad'
              )}
            </button>
            <Link href={cancelHref} className="btn btn-secondary">
              Cancelar
            </Link>
          </div>
        </div>
      </div>
    </form>
  )
}
