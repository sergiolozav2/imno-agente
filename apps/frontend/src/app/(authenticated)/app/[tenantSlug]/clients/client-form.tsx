'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { LEAD_LABELS, LEAD_STATUSES, type BuyerClient, type LeadStatus } from './client-types'

interface ClientFormProps {
  tenantSlug: string
  tenantId: string
  /** Present when editing; omit to create a new client. */
  client?: BuyerClient
}

/**
 * Create / edit form for a buyer client. Creating returns to the list,
 * updating returns to that client's profile.
 */
export function ClientForm({ tenantSlug, tenantId, client }: ClientFormProps) {
  const router = useRouter()
  const isEdit = Boolean(client)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    name: client?.name ?? '',
    email: client?.email ?? '',
    phone: client?.normalizedPhone ?? '',
    leadStatus: client?.leadStatus ?? ('Warm' as LeadStatus),
  })

  const cancelHref = isEdit
    ? `/app/${tenantSlug}/clients/${client!.id}`
    : `/app/${tenantSlug}/clients`

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const phone = formData.phone.trim()
      const email = formData.email.trim()

      const response = await fetch(
        isEdit ? `/api/buyer-clients/${client!.id}` : '/api/buyer-clients',
        {
          method: isEdit ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(
            isEdit
              ? {
                  name: formData.name,
                  leadStatus: formData.leadStatus,
                  normalizedPhone: phone || null,
                  email: email || null,
                }
              : {
                  tenant: tenantId,
                  name: formData.name,
                  leadStatus: formData.leadStatus,
                  ...(phone ? { normalizedPhone: phone } : {}),
                  ...(email ? { email } : {}),
                },
          ),
        },
      )

      if (!response.ok) {
        const data = await response.json().catch(() => null)
        throw new Error(data?.errors?.[0]?.message || data?.message || 'No se pudo guardar')
      }

      router.push(cancelHref)
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

      <div className="form-group">
        <label className="form-label" htmlFor="client-name">
          Nombre *
        </label>
        <input
          id="client-name"
          type="text"
          className="form-input"
          value={formData.name}
          onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
          placeholder="Juan Pérez"
          required
        />
      </div>

      <div className="form-group">
        <label className="form-label" htmlFor="client-phone">
          Teléfono
        </label>
        <input
          id="client-phone"
          type="tel"
          className="form-input"
          value={formData.phone}
          onChange={(e) => setFormData((prev) => ({ ...prev, phone: e.target.value }))}
          placeholder="+34600123456"
        />
      </div>

      <div className="form-group">
        <label className="form-label" htmlFor="client-email">
          Email
        </label>
        <input
          id="client-email"
          type="email"
          className="form-input"
          value={formData.email}
          onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
          placeholder="juan@ejemplo.com"
        />
      </div>

      <div className="form-group">
        <label className="form-label" htmlFor="client-status">
          Estado del lead
        </label>
        <select
          id="client-status"
          className="form-select"
          value={formData.leadStatus}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, leadStatus: e.target.value as LeadStatus }))
          }
        >
          {LEAD_STATUSES.map((status) => (
            <option key={status} value={status}>
              {LEAD_LABELS[status]}
            </option>
          ))}
        </select>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? (
            <>
              <span className="spinner" /> Guardando...
            </>
          ) : isEdit ? (
            'Guardar cambios'
          ) : (
            'Crear cliente'
          )}
        </button>
        <Link href={cancelHref} className="btn btn-secondary">
          Cancelar
        </Link>
      </div>
    </form>
  )
}
