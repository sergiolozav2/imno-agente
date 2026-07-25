'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface NewClientProps {
  tenantSlug: string
  tenantId: string
}

export function NewClient({ tenantSlug, tenantId }: NewClientProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    leadStatus: 'Warm' as 'Cold' | 'Warm' | 'Hot',
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const payload: Record<string, unknown> = {
        tenant: tenantId,
        name: formData.name,
        leadStatus: formData.leadStatus,
      }

      if (formData.email) payload.email = formData.email
      if (formData.phone) payload.normalizedPhone = formData.phone

      const response = await fetch('/api/buyer-clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.message || 'No se pudo crear el cliente')
      }

      router.push(`/app/${tenantSlug}/clients`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear el cliente')
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

      <div className="form-group">
        <label className="form-label">Nombre *</label>
        <input
          type="text"
          className="form-input"
          value={formData.name}
          onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
          placeholder="Juan Pérez"
          required
        />
      </div>

      <div className="form-group">
        <label className="form-label">Teléfono</label>
        <input
          type="tel"
          className="form-input"
          value={formData.phone}
          onChange={(e) => setFormData((prev) => ({ ...prev, phone: e.target.value }))}
          placeholder="+34600123456"
        />
      </div>

      <div className="form-group">
        <label className="form-label">Email</label>
        <input
          type="email"
          className="form-input"
          value={formData.email}
          onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
          placeholder="juan@ejemplo.com"
        />
      </div>

      <div className="form-group">
        <label className="form-label">Estado del lead</label>
        <select
          className="form-select"
          value={formData.leadStatus}
          onChange={(e) =>
            setFormData((prev) => ({
              ...prev,
              leadStatus: e.target.value as 'Cold' | 'Warm' | 'Hot',
            }))
          }
        >
          <option value="Cold">Frío</option>
          <option value="Warm">Templado</option>
          <option value="Hot">Caliente</option>
        </select>
      </div>

      <button
        type="submit"
        className="btn btn-primary"
        style={{ marginTop: '0.25rem' }}
        disabled={loading}
      >
        {loading ? (
          <>
            <span className="spinner" /> Creando...
          </>
        ) : (
          'Crear cliente'
        )}
      </button>
    </form>
  )
}
