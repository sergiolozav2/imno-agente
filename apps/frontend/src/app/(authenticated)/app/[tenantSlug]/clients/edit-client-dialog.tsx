'use client'

import { useEffect, useState } from 'react'
import { Dialog } from '@/components/dialog'
import { IconPencil } from '@/components/icons'
import { LEAD_LABELS, LEAD_STATUSES, type BuyerClient, type LeadStatus } from './client-types'

interface EditClientDialogProps {
  /** The client being edited, or null when the dialog is closed. */
  client: BuyerClient | null
  onClose: () => void
  /** Receives the updated client returned by the API. */
  onSaved: (client: BuyerClient) => void
}

/** Modal form to update a buyer client's details. */
export function EditClientDialog({ client, onClose, onSaved }: EditClientDialogProps) {
  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    leadStatus: 'Cold' as LeadStatus,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!client) return
    setForm({
      name: client.name ?? '',
      phone: client.normalizedPhone ?? '',
      email: client.email ?? '',
      leadStatus: client.leadStatus,
    })
    setError(null)
  }, [client])

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!client) return

    setSaving(true)
    setError(null)

    try {
      const response = await fetch(`/api/buyer-clients/${client.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          leadStatus: form.leadStatus,
          normalizedPhone: form.phone.trim() || null,
          email: form.email.trim() || null,
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data?.errors?.[0]?.message || data?.message || 'No se pudo guardar')
      }

      onSaved((data.doc ?? data) as BuyerClient)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog
      open={Boolean(client)}
      onClose={onClose}
      title="Editar cliente"
      description="Actualiza los datos del contacto"
      icon={<IconPencil width={20} height={20} />}
    >
      <form onSubmit={handleSubmit}>
        {error && (
          <div className="alert alert-error" style={{ marginBottom: '1.25rem' }}>
            {error}
          </div>
        )}

        <div className="form-group">
          <label className="form-label" htmlFor="edit-client-name">
            Nombre *
          </label>
          <input
            id="edit-client-name"
            type="text"
            className="form-input"
            value={form.name}
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            required
          />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="edit-client-phone">
            Teléfono
          </label>
          <input
            id="edit-client-phone"
            type="tel"
            className="form-input"
            value={form.phone}
            onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
            placeholder="+34600123456"
          />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="edit-client-email">
            Email
          </label>
          <input
            id="edit-client-email"
            type="email"
            className="form-input"
            value={form.email}
            onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
            placeholder="juan@ejemplo.com"
          />
        </div>

        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label" htmlFor="edit-client-status">
            Estado del lead
          </label>
          <select
            id="edit-client-status"
            className="form-select"
            value={form.leadStatus}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, leadStatus: e.target.value as LeadStatus }))
            }
          >
            {LEAD_STATUSES.map((status) => (
              <option key={status} value={status}>
                {LEAD_LABELS[status]}
              </option>
            ))}
          </select>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '0.5rem',
            marginTop: '1.5rem',
          }}
        >
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? (
              <>
                <span className="spinner" /> Guardando...
              </>
            ) : (
              'Guardar cambios'
            )}
          </button>
        </div>
      </form>
    </Dialog>
  )
}
