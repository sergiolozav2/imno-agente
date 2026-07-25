'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { IconUpload } from '@/components/icons'

interface MediaAsset {
  id: string
  url: string
  filename: string
  kind: string
}

interface FormData {
  reference: string
  title: string
  description: string
  price: string
  currency: string
  zone: string
  pricingUnit: 'total' | 'per_sqm' | 'per_month'
  status: 'available' | 'reserved' | 'sold'
  bedrooms: string
  bathrooms: string
  areaSqm: string
  images: string[]
  mainImage: string
  model3d: string
}

interface NewPropertyProps {
  tenantSlug: string
  tenantId: string
}

export function NewProperty({ tenantSlug, tenantId }: NewPropertyProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mediaAssets, setMediaAssets] = useState<MediaAsset[]>([])
  const [uploading, setUploading] = useState(false)

  const [formData, setFormData] = useState<FormData>({
    reference: '',
    title: '',
    description: '',
    price: '',
    currency: 'EUR',
    zone: '',
    pricingUnit: 'total',
    status: 'available',
    bedrooms: '',
    bathrooms: '',
    areaSqm: '',
    images: [],
    mainImage: '',
    model3d: '',
  })

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

      if (formData.images.length === 0) {
        setFormData((prev) => ({
          ...prev,
          images: [...prev.images, newAsset.doc.id],
          mainImage: newAsset.doc.id,
        }))
      } else {
        setFormData((prev) => ({
          ...prev,
          images: [...prev.images, newAsset.doc.id],
        }))
      }
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

      const payload = {
        tenant: tenantId,
        reference: formData.reference,
        title: formData.title,
        description: formData.description || undefined,
        price: parseFloat(formData.price),
        currency: formData.currency,
        zone: formData.zone,
        pricingUnit: formData.pricingUnit,
        status: formData.status,
        bedrooms: formData.bedrooms ? parseInt(formData.bedrooms) : undefined,
        bathrooms: formData.bathrooms ? parseInt(formData.bathrooms) : undefined,
        areaSqm: formData.areaSqm ? parseFloat(formData.areaSqm) : undefined,
        images: formData.images.length > 0 ? formData.images : undefined,
        mainImage: formData.mainImage || undefined,
        model3d: formData.model3d || undefined,
      }

      const response = await fetch('/api/properties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.message || 'No se pudo crear la propiedad')
      }

      const result = await response.json()
      router.push(`/app/${tenantSlug}/properties/${result.doc.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear la propiedad')
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
            <label className="form-label">Referencia *</label>
            <input
              type="text"
              className="form-input"
              value={formData.reference}
              onChange={(e) => setFormData((prev) => ({ ...prev, reference: e.target.value }))}
              placeholder="PROP-001"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Título *</label>
            <input
              type="text"
              className="form-input"
              value={formData.title}
              onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
              placeholder="Apartamento en el centro de la ciudad"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Descripción</label>
            <textarea
              className="form-textarea"
              value={formData.description}
              onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
              placeholder="Describe la propiedad..."
              rows={4}
            />
          </div>

          <div className="grid-2" style={{ gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Precio *</label>
              <input
                type="number"
                className="form-input"
                value={formData.price}
                onChange={(e) => setFormData((prev) => ({ ...prev, price: e.target.value }))}
                placeholder="250000"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Moneda</label>
              <select
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
              <label className="form-label">Zona *</label>
              <input
                type="text"
                className="form-input"
                value={formData.zone}
                onChange={(e) => setFormData((prev) => ({ ...prev, zone: e.target.value }))}
                placeholder="Centro"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Unidad de precio</label>
              <select
                className="form-select"
                value={formData.pricingUnit}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    pricingUnit: e.target.value as FormData['pricingUnit'],
                  }))
                }
              >
                <option value="total">Total</option>
                <option value="per_sqm">Por m²</option>
                <option value="per_month">Por mes</option>
              </select>
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Estado</label>
            <select
              className="form-select"
              value={formData.status}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, status: e.target.value as FormData['status'] }))
              }
            >
              <option value="available">Disponible</option>
              <option value="reserved">Reservada</option>
              <option value="sold">Vendida</option>
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
                <label className="form-label">Dormitorios</label>
                <input
                  type="number"
                  className="form-input"
                  value={formData.bedrooms}
                  onChange={(e) => setFormData((prev) => ({ ...prev, bedrooms: e.target.value }))}
                  placeholder="3"
                  min="0"
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Baños</label>
                <input
                  type="number"
                  className="form-input"
                  value={formData.bathrooms}
                  onChange={(e) => setFormData((prev) => ({ ...prev, bathrooms: e.target.value }))}
                  placeholder="2"
                  min="0"
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Área (m²)</label>
                <input
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
                  const isSelected = formData.images.includes(asset.id)
                  const isMain = formData.mainImage === asset.id
                  return (
                    <button
                      type="button"
                      key={asset.id}
                      onClick={() => toggleImageSelection(asset.id)}
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
                  <span className="spinner" /> Creando...
                </>
              ) : (
                'Crear propiedad'
              )}
            </button>
          </div>
        </div>
      </div>
    </form>
  )
}
