'use client'

import { useState } from 'react'
import { IconSparkles, IconVideo, IconCopy, IconCheck } from '@/components/icons'

interface Property {
  id: string
  reference: string
  title: string
  description?: string
  price: number
  currency: string
}

interface ContentGeneratorProps {
  tenantId: string
  property: Property
}

interface SocialCopy {
  title: string
  description: string
  caption: string
  hashtags: string[]
}

export function ContentGenerator({ tenantId, property }: ContentGeneratorProps) {
  const [copyLoading, setCopyLoading] = useState(false)
  const [videoLoading, setVideoLoading] = useState(false)
  const [socialCopy, setSocialCopy] = useState<SocialCopy | null>(null)
  const [copyError, setCopyError] = useState<string | null>(null)
  const [videoError, setVideoError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  async function generateCopy() {
    setCopyLoading(true)
    setCopyError(null)
    setSocialCopy(null)

    try {
      const response = await fetch('/api/content/generate-copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, propertyId: property.id }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.message || 'No se pudo generar el texto')
      }

      const data = await response.json()
      setSocialCopy(data.copy)
    } catch (err) {
      setCopyError(err instanceof Error ? err.message : 'No se pudo generar el texto')
    } finally {
      setCopyLoading(false)
    }
  }

  async function generateVideo() {
    setVideoLoading(true)
    setVideoError(null)

    try {
      const response = await fetch('/api/content/render-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, propertyId: property.id }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.message || 'No se pudo renderizar el vídeo')
      }

      alert('Renderizado de vídeo iniciado. Esto puede tardar unos minutos.')
    } catch (err) {
      setVideoError(err instanceof Error ? err.message : 'No se pudo renderizar el vídeo')
    } finally {
      setVideoLoading(false)
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Social Copy */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Texto para redes</h3>
          <button onClick={generateCopy} className="btn btn-primary btn-sm" disabled={copyLoading}>
            {copyLoading ? (
              <>
                <span className="spinner" /> Generando...
              </>
            ) : (
              <>
                <IconSparkles width={16} height={16} /> Generar texto
              </>
            )}
          </button>
        </div>

        {copyError && <div className="alert alert-error">{copyError}</div>}

        {socialCopy ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <Field label="Título">{socialCopy.title}</Field>
            <Field label="Descripción" pre>
              {socialCopy.description}
            </Field>
            <div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '0.25rem',
                }}
              >
                <label className="form-label" style={{ marginBottom: 0 }}>
                  Pie de foto
                </label>
                <button
                  onClick={() => copyToClipboard(socialCopy.caption)}
                  className="btn btn-ghost btn-sm"
                >
                  {copied ? (
                    <>
                      <IconCheck width={15} height={15} /> Copiado
                    </>
                  ) : (
                    <>
                      <IconCopy width={15} height={15} /> Copiar
                    </>
                  )}
                </button>
              </div>
              <p style={{ whiteSpace: 'pre-wrap' }}>{socialCopy.caption}</p>
            </div>
            <div>
              <label className="form-label">Hashtags</label>
              <p style={{ color: 'var(--color-primary)' }}>{socialCopy.hashtags.join(' ')}</p>
            </div>
          </div>
        ) : (
          !copyError && (
            <p className="page-subtitle" style={{ marginTop: 0 }}>
              Genera títulos, descripciones y hashtags optimizados para redes sociales a partir de
              esta propiedad.
            </p>
          )
        )}
      </div>

      {/* Video Generation */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Vídeo de la propiedad</h3>
          <button
            onClick={generateVideo}
            className="btn btn-primary btn-sm"
            disabled={videoLoading}
          >
            {videoLoading ? (
              <>
                <span className="spinner" /> Renderizando...
              </>
            ) : (
              <>
                <IconVideo width={16} height={16} /> Renderizar vídeo
              </>
            )}
          </button>
        </div>

        {videoError && <div className="alert alert-error">{videoError}</div>}

        <p className="page-subtitle" style={{ marginTop: 0 }}>
          Genera un vídeo tipo slideshow 9:16 con las imágenes de la propiedad y música de fondo.
        </p>

        <div className="alert" style={{ marginTop: '1rem' }}>
          <span style={{ fontSize: '0.8125rem' }}>
            <strong>Nota:</strong> el renderizado requiere FFmpeg instalado y configurado en el
            servidor. El vídeo se genera como MP4 9:16 apto para redes sociales.
          </span>
        </div>
      </div>
    </div>
  )
}

function Field({
  label,
  children,
  pre,
}: {
  label: string
  children: React.ReactNode
  pre?: boolean
}) {
  return (
    <div>
      <label className="form-label">{label}</label>
      <p style={pre ? { whiteSpace: 'pre-wrap' } : undefined}>{children}</p>
    </div>
  )
}
