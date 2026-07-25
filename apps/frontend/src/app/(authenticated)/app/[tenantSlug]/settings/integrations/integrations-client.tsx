'use client'

import { useState, type ReactNode } from 'react'
import { Dialog } from '@/components/dialog'
import {
  IconWhatsApp,
  IconInstagram,
  IconEmail,
  IconTelegram,
  IconTiktok,
} from '@/components/icons'
import { WhatsAppSetup } from './whatsapp-setup'
import { useWhatsAppConnection, type WhatsAppInstance } from './use-whatsapp-connection'

interface IntegrationsClientProps {
  tenantId: string
  tenantSlug: string
  whatsappInstance: WhatsAppInstance | null
}

interface IntegrationDef {
  id: string
  name: string
  description: string
  icon: ReactNode
  available: boolean
}

export function IntegrationsClient({
  tenantId,
  tenantSlug,
  whatsappInstance,
}: IntegrationsClientProps) {
  const [whatsappOpen, setWhatsappOpen] = useState(false)

  // Held here (not inside the dialog) so the card badge and the dialog share the
  // same live connection state, and polling continues while the dialog is closed.
  const whatsapp = useWhatsAppConnection(tenantId, tenantSlug, whatsappInstance)

  const integrations: IntegrationDef[] = [
    {
      id: 'whatsapp',
      name: 'WhatsApp',
      description: 'Conecta tu WhatsApp Business para captar leads automáticamente.',
      icon: <IconWhatsApp width={26} height={26} />,
      available: true,
    },
    {
      id: 'instagram',
      name: 'Instagram',
      description:
        'Conecta tu cuenta de Instagram para gestionar mensajes directos y captar leads.',
      icon: <IconInstagram width={26} height={26} />,
      available: false,
    },
    {
      id: 'email',
      name: 'Email',
      description:
        'Conecta tu correo para recibir y responder consultas de clientes en un solo lugar.',
      icon: <IconEmail width={26} height={26} />,
      available: false,
    },
    {
      id: 'telegram',
      name: 'Telegram',
      description: 'Conecta tu bot de Telegram para atender a tus clientes al instante.',
      icon: <IconTelegram width={26} height={26} />,
      available: false,
    },
    {
      id: 'tiktok',
      name: 'TikTok',
      description: 'Conecta tu cuenta de TikTok para captar leads desde tus videos y mensajes.',
      icon: <IconTiktok width={26} height={26} />,
      available: false,
    },
  ]

  function renderWhatsAppBadge() {
    if (whatsapp.checking) {
      return <span className="badge badge-neutral">Verificando...</span>
    }

    switch (whatsapp.instance?.connectionState) {
      case 'connected':
        return <span className="badge badge-success">Conectado</span>
      case 'qr_required':
        return <span className="badge badge-warning">Escanea el QR</span>
      case 'connecting':
        return <span className="badge badge-warning">Conectando</span>
      default:
        return <span className="badge badge-warning">Sin conectar</span>
    }
  }

  function renderStatusBadge(integration: IntegrationDef) {
    if (!integration.available) {
      return <span className="badge badge-neutral badge-plain">Próximamente</span>
    }
    if (integration.id === 'whatsapp') {
      return renderWhatsAppBadge()
    }
    return null
  }

  return (
    <>
      <div className="grid-2">
        {integrations.map((integration) => {
          const inner = (
            <>
              <div className="integration-card-top">
                <span className="integration-icon">{integration.icon}</span>
                {renderStatusBadge(integration)}
              </div>
              <div>
                <h3 className="integration-title">{integration.name}</h3>
                <p className="integration-description">{integration.description}</p>
              </div>
            </>
          )

          if (integration.id === 'whatsapp' && integration.available) {
            return (
              <button
                key={integration.id}
                type="button"
                className="integration-card"
                onClick={() => setWhatsappOpen(true)}
              >
                {inner}
              </button>
            )
          }

          return (
            <div
              key={integration.id}
              className={`integration-card${integration.available ? '' : ' is-soon'}`}
            >
              {inner}
            </div>
          )
        })}
      </div>

      <Dialog
        open={whatsappOpen}
        onClose={() => setWhatsappOpen(false)}
        icon={<IconWhatsApp width={22} height={22} />}
        title="WhatsApp"
        description="Conecta tu WhatsApp Business para captar leads automáticamente."
        maxWidth={640}
      >
        <WhatsAppSetup connection={whatsapp} />
      </Dialog>
    </>
  )
}
