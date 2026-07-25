'use client'

import { useEffect } from 'react'
import { IconWhatsApp, IconRefresh, IconCheck } from '@/components/icons'
import type { WhatsAppConnection, WhatsAppConnectionState } from './use-whatsapp-connection'

interface WhatsAppSetupProps {
  connection: WhatsAppConnection
}

const STATE_LABELS: Record<WhatsAppConnectionState, string> = {
  connecting: 'Conectando',
  qr_required: 'Escanea el QR',
  connected: 'Conectado',
  disconnected: 'Desconectado',
}

export function WhatsAppSetup({ connection }: WhatsAppSetupProps) {
  const { instance, qrCode, loading, checking, error, createInstance, fetchQrCode, refreshStatus } =
    connection

  const isConnected = instance?.connectionState === 'connected'
  const needsQr =
    instance?.connectionState === 'qr_required' || instance?.connectionState === 'connecting'

  // Once the live state is known and the session isn't connected, pull a QR so
  // the user can scan without an extra click.
  useEffect(() => {
    if (checking || !instance || isConnected || qrCode) return
    void fetchQrCode()
  }, [checking, instance, isConnected, qrCode, fetchQrCode])

  const stateBadge = isConnected ? 'badge-success' : needsQr ? 'badge-warning' : 'badge-error'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {error && <div className="alert alert-error">{error}</div>}

      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Instancia de WhatsApp</h3>
          {instance &&
            (checking ? (
              <span className="badge badge-neutral">Verificando...</span>
            ) : (
              <span className={`badge ${stateBadge}`}>
                {STATE_LABELS[instance.connectionState]}
              </span>
            ))}
        </div>

        {!instance ? (
          <div>
            <p className="page-subtitle" style={{ marginTop: 0, marginBottom: '1rem' }}>
              No hay ninguna instancia configurada. Crea una para empezar a recibir leads por
              WhatsApp.
            </p>
            <button onClick={createInstance} className="btn btn-primary" disabled={loading}>
              {loading ? (
                <>
                  <span className="spinner" /> Creando...
                </>
              ) : (
                <>
                  <IconWhatsApp width={18} height={18} /> Crear instancia
                </>
              )}
            </button>
          </div>
        ) : (
          <div>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
                marginBottom: '1rem',
              }}
            >
              <p style={{ fontSize: '0.875rem' }}>
                <strong>Instancia:</strong> {instance.instanceName}
              </p>
              {instance.webhookState && (
                <p
                  style={{
                    fontSize: '0.875rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                  }}
                >
                  <strong>Webhook:</strong>
                  <span
                    className={`badge ${instance.webhookState === 'configured' ? 'badge-success' : 'badge-warning'}`}
                  >
                    {instance.webhookState === 'configured' ? 'configurado' : instance.webhookState}
                  </span>
                </p>
              )}
            </div>

            {!checking && needsQr && (
              <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
                <p className="page-subtitle" style={{ marginTop: 0, marginBottom: '1rem' }}>
                  Escanea este código QR con WhatsApp en tu teléfono para conectar
                </p>
                {qrCode ? (
                  <div
                    style={{
                      display: 'inline-block',
                      padding: '1rem',
                      background: 'white',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-border)',
                    }}
                  >
                    <img
                      src={qrCode}
                      alt="Código QR de WhatsApp"
                      style={{ width: '256px', height: '256px' }}
                    />
                  </div>
                ) : (
                  <button
                    onClick={() => fetchQrCode()}
                    className="btn btn-secondary"
                    disabled={loading}
                  >
                    Mostrar código QR
                  </button>
                )}
              </div>
            )}

            {isConnected && (
              <div className="alert alert-success">
                <IconCheck width={18} height={18} style={{ flexShrink: 0 }} />
                <div>
                  <p style={{ fontWeight: 600 }}>WhatsApp conectado</p>
                  <p style={{ fontSize: '0.875rem', marginTop: '0.25rem' }}>
                    Tu número de WhatsApp Business está conectado y listo. Los mensajes entrantes
                    crearán leads automáticamente.
                  </p>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
              <button
                onClick={refreshStatus}
                className="btn btn-secondary btn-sm"
                disabled={loading}
              >
                <IconRefresh width={16} height={16} /> Actualizar estado
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="card">
        <h3 className="card-title" style={{ marginBottom: '0.75rem' }}>
          Cómo funciona
        </h3>
        <ol
          style={{
            paddingLeft: '1.25rem',
            fontSize: '0.875rem',
            lineHeight: 1.9,
            color: 'var(--color-ink-700)',
          }}
        >
          <li>Crea una instancia de WhatsApp arriba</li>
          <li>Escanea el código QR con WhatsApp en tu teléfono</li>
          <li>Una vez conectado, cualquier mensaje a este número crea un lead</li>
          <li>El agente de IA responde automáticamente a las consultas</li>
          <li>Gestiona las conversaciones desde la sección de clientes</li>
        </ol>
      </div>
    </div>
  )
}
