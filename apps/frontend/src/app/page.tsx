import Link from 'next/link'
import {
  IconBuilding,
  IconUsers,
  IconWhatsApp,
  IconSparkles,
  IconCube,
  IconChat,
} from '@/components/icons'

const FEATURES = [
  {
    icon: IconCube,
    title: 'Propiedades en 3D',
    text: 'Catálogo de inmuebles con visor 3D interactivo.',
  },
  {
    icon: IconUsers,
    title: 'Seguimiento de leads',
    text: 'Gestiona clientes y conversaciones en un solo lugar.',
  },
  {
    icon: IconWhatsApp,
    title: 'Integración WhatsApp',
    text: 'Captura leads automáticamente por WhatsApp.',
  },
  {
    icon: IconSparkles,
    title: 'Contenido con IA',
    text: 'Genera textos y vídeos para redes al instante.',
  },
]

export default function HomePage() {
  return (
    <main style={{ minHeight: '100vh' }}>
      {/* Top bar */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '1rem 1.5rem',
          maxWidth: '1120px',
          margin: '0 auto',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
          <span className="sidebar-logo" style={{ background: 'var(--color-primary)' }}>
            IA
          </span>
          <span style={{ fontWeight: 700, fontSize: '1.0625rem' }}>Imno Agente</span>
        </div>
        <Link href="/login" className="btn btn-primary btn-sm">
          Iniciar sesión
        </Link>
      </header>

      {/* Hero */}
      <section
        style={{
          maxWidth: '820px',
          margin: '0 auto',
          padding: '4rem 1.5rem 2.5rem',
          textAlign: 'center',
        }}
      >
        <span className="badge badge-success badge-plain" style={{ marginBottom: '1.25rem' }}>
          Plataforma inmobiliaria con IA
        </span>
        <h1
          style={{ fontSize: 'clamp(2rem, 5vw, 3rem)', letterSpacing: '-0.03em', lineHeight: 1.1 }}
        >
          El copiloto de IA para tu agencia inmobiliaria
        </h1>
        <p
          style={{
            color: 'var(--color-text-muted)',
            fontSize: '1.0625rem',
            marginTop: '1rem',
            maxWidth: '560px',
            marginInline: 'auto',
          }}
        >
          Gestiona propiedades, capta leads por WhatsApp y genera contenido para redes, todo desde
          un único panel multi-tenant.
        </p>
        <div
          style={{
            display: 'flex',
            gap: '0.75rem',
            justifyContent: 'center',
            marginTop: '2rem',
            flexWrap: 'wrap',
          }}
        >
          <Link href="/login" className="btn btn-primary btn-lg">
            <IconBuilding width={18} height={18} /> Acceso agencias
          </Link>
          <Link href="/chat/demo" className="btn btn-secondary btn-lg">
            <IconChat width={18} height={18} /> Probar chat público
          </Link>
        </div>
      </section>

      {/* Features */}
      <section style={{ maxWidth: '1120px', margin: '0 auto', padding: '1rem 1.5rem 4rem' }}>
        <div className="grid-auto">
          {FEATURES.map((f) => {
            const Icon = f.icon
            return (
              <div key={f.title} className="card card-hover">
                <span className="empty-state-icon" style={{ marginBottom: '0.875rem' }}>
                  <Icon />
                </span>
                <h3 style={{ fontSize: '1rem' }}>{f.title}</h3>
                <p className="page-subtitle" style={{ marginTop: '0.375rem' }}>
                  {f.text}
                </p>
              </div>
            )
          })}
        </div>
      </section>
    </main>
  )
}
