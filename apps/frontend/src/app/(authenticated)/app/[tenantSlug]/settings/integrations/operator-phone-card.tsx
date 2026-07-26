'use client'

import { useState } from 'react'
import { IconCheck } from '@/components/icons'

/**
 * Registers the operator's own WhatsApp number.
 *
 * The platform line is one number that every agency writes to, so it cannot
 * tell who is on the other end the way a tenant line can. This is how a person
 * says "that number is me", which is what lets the assistant answer them on
 * WhatsApp with their agency's data.
 */
export function OperatorPhoneCard({ initialPhone }: { initialPhone: string | null }) {
  const [phone, setPhone] = useState(initialPhone ?? '')
  const [saved, setSaved] = useState<string | null>(initialPhone)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    setSaving(true)
    setError(null)
    try {
      const response = await fetch('/api/profile/whatsapp-phone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) {
        setError(data?.message ?? 'No se pudo guardar el número')
        return
      }
      setSaved(data?.phone ?? null)
      setPhone(data?.phone ?? '')
    } catch {
      setError('No se pudo guardar el número')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="card" style={{ marginTop: '1.5rem' }}>
      <div className="card-header">
        <h3 className="card-title">Tu número para hablar con el asistente</h3>
        {saved && (
          <span className="badge badge-success">
            <IconCheck width={14} height={14} /> Registrado
          </span>
        )}
      </div>

      <p className="page-subtitle" style={{ marginTop: 0, marginBottom: '1rem' }}>
        Escribe al número de la plataforma desde este teléfono y el asistente te responderá por
        WhatsApp con los datos de tu agencia.
      </p>

      {error && <div className="alert alert-error">{error}</div>}

      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
        <input
          className="input"
          type="tel"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          placeholder="+34 600 123 456"
          style={{ maxWidth: '260px' }}
        />
        <button onClick={save} className="btn btn-primary btn-sm" disabled={saving}>
          {saving ? 'Guardando...' : 'Guardar'}
        </button>
      </div>
    </div>
  )
}
