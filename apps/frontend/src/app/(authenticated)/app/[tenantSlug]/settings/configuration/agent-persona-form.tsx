'use client'

import { useState } from 'react'
import { IconCheck } from '@/components/icons'

/**
 * Edits how this agency's WhatsApp assistant presents itself to buyers.
 *
 * Every field is optional and every placeholder shows the value the assistant
 * uses when the field is left empty, so the form doubles as documentation of the
 * current behaviour — an agency only fills in what it wants to change.
 */

export interface AgentPersona {
  agentAssistantName: string
  agentBusinessName: string
  agentLanguage: string
  agentTone: string
  agentGreeting: string
  agentBusinessNotes: string
  agentHandoffLine: string
  agentMaxReplyCharacters: string
}

/** Mirrors the agent's fallbacks so the placeholders show the real behaviour. */
export const PERSONA_DEFAULTS = {
  assistantName: 'Ana',
  language: 'es',
  tone: 'Cercano y profesional. Tuteo, frases cortas, sin tecnicismos y sin presionar.',
  businessNotes:
    'Atendemos consultas por WhatsApp todos los días.\nLas visitas se coordinan con un agente humano.',
  handoffLine: 'Te paso con un agente del equipo para que lo veáis en detalle.',
  maxReplyCharacters: '600',
}

function defaultGreeting(assistantName: string, businessName: string): string {
  return `¡Hola! Soy ${assistantName}, del equipo de ${businessName}. ¿En qué zona estás buscando?`
}

export function AgentPersonaForm({
  tenantSlug,
  tenantName,
  initial,
}: {
  tenantSlug: string
  tenantName: string
  initial: AgentPersona
}) {
  const [form, setForm] = useState(initial)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function update(field: keyof AgentPersona, value: string) {
    setForm((current) => ({ ...current, [field]: value }))
    setSaved(false)
  }

  async function save() {
    setSaving(true)
    setError(null)
    try {
      const response = await fetch('/api/tenant/agent-persona', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantSlug, ...form }),
      })
      if (!response.ok) {
        const data = await response.json().catch(() => null)
        setError(data?.message ?? 'No se pudo guardar la configuración')
        return
      }
      setSaved(true)
    } catch {
      setError('No se pudo guardar la configuración')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="card" style={{ marginTop: '1.5rem' }}>
      <div className="card-header">
        <h3 className="card-title">Personalidad del asistente</h3>
        {saved && (
          <span className="badge badge-success">
            <IconCheck width={14} height={14} /> Guardado
          </span>
        )}
      </div>

      <p className="page-subtitle" style={{ marginTop: 0, marginBottom: '1.5rem' }}>
        Así se presenta el asistente que responde a tus clientes en tu WhatsApp. Deja un campo vacío
        para usar el valor por defecto que aparece de ejemplo.
      </p>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="grid-2" style={{ gap: '1rem' }}>
        <Field label="Nombre del asistente" hint="Con este nombre se presenta ante tus clientes.">
          <input
            className="input"
            value={form.agentAssistantName}
            onChange={(event) => update('agentAssistantName', event.target.value)}
            placeholder={PERSONA_DEFAULTS.assistantName}
          />
        </Field>

        <Field label="Nombre de la agencia" hint="Cómo debe nombrar a tu agencia al hablar.">
          <input
            className="input"
            value={form.agentBusinessName}
            onChange={(event) => update('agentBusinessName', event.target.value)}
            placeholder={tenantName}
          />
        </Field>

        <Field label="Idioma" hint="Idioma en el que responde por defecto.">
          <select
            className="input"
            value={form.agentLanguage || PERSONA_DEFAULTS.language}
            onChange={(event) => update('agentLanguage', event.target.value)}
          >
            <option value="es">Español</option>
            <option value="ca">Català</option>
            <option value="en">English</option>
          </select>
        </Field>

        <Field
          label="Longitud máxima de respuesta"
          hint="En caracteres. WhatsApp premia los mensajes cortos."
        >
          <input
            className="input"
            type="number"
            min={100}
            max={4000}
            value={form.agentMaxReplyCharacters}
            onChange={(event) => update('agentMaxReplyCharacters', event.target.value)}
            placeholder={PERSONA_DEFAULTS.maxReplyCharacters}
          />
        </Field>
      </div>

      <div style={{ display: 'grid', gap: '1rem', marginTop: '1rem' }}>
        <Field label="Tono" hint="Formalidad, longitud de las frases y cuánto debe insistir.">
          <textarea
            className="input"
            rows={2}
            value={form.agentTone}
            onChange={(event) => update('agentTone', event.target.value)}
            placeholder={PERSONA_DEFAULTS.tone}
          />
        </Field>

        <Field
          label="Saludo inicial"
          hint="Frase exacta con la que abre la primera conversación. Si lo dejas vacío se genera con los nombres de arriba."
        >
          <textarea
            className="input"
            rows={2}
            value={form.agentGreeting}
            onChange={(event) => update('agentGreeting', event.target.value)}
            placeholder={defaultGreeting(
              form.agentAssistantName.trim() || PERSONA_DEFAULTS.assistantName,
              form.agentBusinessName.trim() || tenantName,
            )}
          />
        </Field>

        <Field
          label="Datos de tu agencia"
          hint="Horarios, zonas, condiciones. Un dato por línea; solo dirá lo que escribas aquí."
        >
          <textarea
            className="input"
            rows={4}
            value={form.agentBusinessNotes}
            onChange={(event) => update('agentBusinessNotes', event.target.value)}
            placeholder={PERSONA_DEFAULTS.businessNotes}
          />
        </Field>

        <Field
          label="Cuando piden hablar con una persona"
          hint="Qué responde antes de que tomes el relevo."
        >
          <textarea
            className="input"
            rows={2}
            value={form.agentHandoffLine}
            onChange={(event) => update('agentHandoffLine', event.target.value)}
            placeholder={PERSONA_DEFAULTS.handoffLine}
          />
        </Field>
      </div>

      <div style={{ marginTop: '1.25rem' }}>
        <button onClick={save} className="btn btn-primary" disabled={saving}>
          {saving ? 'Guardando...' : 'Guardar cambios'}
        </button>
      </div>
    </div>
  )
}

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint: string
  children: React.ReactNode
}) {
  return (
    <label style={{ display: 'grid', gap: '0.375rem' }}>
      <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>{label}</span>
      {children}
      <span style={{ fontSize: '0.8125rem', opacity: 0.7 }}>{hint}</span>
    </label>
  )
}
