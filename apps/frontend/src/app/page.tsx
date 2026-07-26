import Link from 'next/link'
import Image from 'next/image'
import {
  IconBuilding,
  IconUsers,
  IconWhatsApp,
  IconSparkles,
  IconMap,
  IconBot,
  IconChat,
} from '@/components/icons'

const STATS = [
  { value: '840+', label: 'Avisos analizados en Santa Cruz' },
  { value: '24/7', label: 'Atención automática por WhatsApp' },
  { value: '<1 min', label: 'De propiedad a reel para redes' },
  { value: '1 panel', label: 'Propiedades, leads y contenido' },
]

const STEPS = [
  {
    title: 'Conecta tu agencia',
    text: 'Crea tu espacio multi-tenant, sube tu catálogo y vincula tu número de WhatsApp en minutos.',
  },
  {
    title: 'Deja que el agente trabaje',
    text: 'La IA responde consultas, califica leads por temperatura y agenda visitas mientras tú cierras.',
  },
  {
    title: 'Publica y vende',
    text: 'Genera descripciones y vídeos verticales por propiedad y publícalos en redes sin diseñador.',
  },
]

export default function HomePage() {
  return (
    <main className="lp">
      <nav className="lp-nav">
        <div className="lp-shell lp-nav-inner">
          <Link href="/" className="lp-brand">
            <span className="lp-brand-mark">
              <Image src="/landing/logo.png" alt="" width={26} height={26} />
            </span>
            Imno Agente
          </Link>
          <div className="lp-nav-links">
            <a href="#producto">Producto</a>
            <a href="#mapa">Mapa de precios</a>
            <a href="#como-funciona">Cómo funciona</a>
          </div>
          <div className="lp-nav-cta">
            <Link href="/chat/demo" className="btn btn-ghost btn-sm">
              Ver demo
            </Link>
            <Link href="/login" className="btn btn-primary btn-sm">
              Iniciar sesión
            </Link>
          </div>
        </div>
      </nav>

      <section className="lp-hero">
        <div className="lp-glow" aria-hidden />
        <div className="lp-shell">
          <span className="lp-pill">
            <b>Nuevo</b> Agente de IA con acciones reales sobre tu cartera
          </span>
          <h1 className="lp-h1">
            El copiloto de IA que <em>vende</em> por tu inmobiliaria
          </h1>
          <p className="lp-lead">
            Gestiona propiedades, capta y califica leads por WhatsApp y genera contenido para redes.
            Todo desde un único panel para tu agencia.
          </p>
          <div className="lp-actions">
            <Link href="/login" className="btn btn-primary btn-lg">
              <IconBuilding width={18} height={18} /> Acceso agencias
            </Link>
            <Link href="/chat/demo" className="btn btn-secondary btn-lg">
              <IconChat width={18} height={18} /> Probar chat público
            </Link>
          </div>
          <p className="lp-microcopy">Sin tarjeta · Espacio de demo listo para explorar</p>

          <div className="lp-shot">
            <div className="lp-shot-bar">
              <span className="lp-dot" />
              <span className="lp-dot" />
              <span className="lp-dot" />
              <span className="lp-shot-url">app.imnoagente.com/mapa-de-precios</span>
            </div>
            <Image
              src="/landing/full-image-heatmap-cost-buildings.png"
              alt="Panel de Imno Agente mostrando el mapa de calor de precios por m²"
              width={1910}
              height={936}
              priority
            />
          </div>
        </div>
      </section>

      <section className="lp-section" id="producto">
        <div className="lp-shell">
          <div className="lp-stats">
            {STATS.map((s) => (
              <div key={s.label} className="lp-stat">
                <b>{s.value}</b>
                <span>{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="lp-section lp-section-alt">
        <div className="lp-shell">
          <div className="lp-section-head lp-center lp-center">
            <span className="lp-eyebrow">Todo en uno</span>
            <h2 className="lp-h2">Menos pestañas. Más operaciones cerradas.</h2>
            <p>
              Un asistente que entiende tu cartera, tus clientes y tus conversaciones — y que puede
              actuar sobre ellos.
            </p>
          </div>

          <div className="lp-bento">
            <div className="lp-tile lp-tile-wide">
              <span className="lp-tile-icon">
                <IconBot width={20} height={20} />
              </span>
              <h3>Asistente con acciones reales</h3>
              <p>
                Pídele en lenguaje natural que busque una propiedad y la envíe por WhatsApp a un
                cliente. Consulta, redacta y ejecuta — con tu confirmación.
              </p>
              <div className="lp-tile-media">
                <Image
                  src="/landing/agentic-chat-sending-whatsapp-message.png"
                  alt="Asistente enviando una propiedad por WhatsApp a un cliente"
                  width={1606}
                  height={936}
                />
              </div>
            </div>

            <div className="lp-tile">
              <span className="lp-tile-icon">
                <IconWhatsApp width={20} height={20} />
              </span>
              <h3>WhatsApp nativo</h3>
              <p>
                Conecta tu número y captura cada lead automáticamente, sin plantillas ni bots
                rígidos.
              </p>
              <div className="lp-tile-media lp-tile-media-crop">
                <Image
                  src="/landing/whatsapp-integration.png"
                  alt="Integración de WhatsApp en el panel"
                  width={1039}
                  height={936}
                />
              </div>
            </div>

            <div className="lp-tile">
              <span className="lp-tile-icon">
                <IconUsers width={20} height={20} />
              </span>
              <h3>Leads por temperatura</h3>
              <p>
                Kanban de frío, templado y caliente para que sepas a quién llamar hoy.
              </p>
              <div className="lp-tile-media lp-tile-media-crop">
                <Image
                  src="/landing/kanban-clients-management.png"
                  alt="Kanban de clientes por temperatura"
                  width={1606}
                  height={936}
                />
              </div>
            </div>

            <div className="lp-tile lp-tile-wide">
              <span className="lp-tile-icon">
                <IconSparkles width={20} height={20} />
              </span>
              <h3>Contenido para redes en un clic</h3>
              <p>
                Descripciones, copies y vídeos verticales generados a partir de las fotos y datos de
                cada inmueble. Listos para Instagram y TikTok.
              </p>
              <div className="lp-tile-media">
                <Image
                  src="/landing/content-generation-for-properties.png"
                  alt="Generación de contenido para propiedades"
                  width={1606}
                  height={936}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="lp-section" id="mapa">
        <div className="lp-shell">
          <div className="lp-section-head lp-center">
            <span className="lp-eyebrow">Inteligencia de mercado</span>
            <h2 className="lp-h2">Sabe cuánto vale cada zona antes de tasar.</h2>
            <p>
              Mapa de calor de precio por m² con datos reales del mercado, filtros por dormitorios,
              superficie y zona, y medianas al instante.
            </p>
          </div>
          <div className="lp-actions">
            <Link href="/map-preview" className="btn btn-primary btn-lg">
              <IconMap width={18} height={18} /> Abrir mapa de precios
            </Link>
          </div>
        </div>
      </section>

      <section className="lp-section lp-section-alt" id="como-funciona">
        <div className="lp-shell">
          <div className="lp-section-head">
            <span className="lp-eyebrow">Cómo funciona</span>
            <h2 className="lp-h2">Operativo el mismo día</h2>
          </div>
          <div className="lp-steps">
            {STEPS.map((s) => (
              <div key={s.title} className="lp-step">
                <h3>{s.title}</h3>
                <p>{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="lp-shell">
        <section className="lp-cta">
          <h2>Tu próxima venta empieza en una conversación</h2>
          <p>
            Prueba el agente público o entra a tu espacio de agencia y descubre cuánto tiempo
            recuperas cada semana.
          </p>
          <div className="lp-actions">
            <Link href="/login" className="btn btn-primary btn-lg">
              <IconBuilding width={18} height={18} /> Acceso agencias
            </Link>
            <Link href="/chat/demo" className="btn btn-secondary btn-lg">
              <IconChat width={18} height={18} /> Probar chat público
            </Link>
          </div>
        </section>
      </div>

      <footer className="lp-footer">
        <div className="lp-shell lp-footer-inner">
          <span>© {new Date().getFullYear()} Imno Agente · Plataforma inmobiliaria con IA</span>
          <span>Santa Cruz de la Sierra, Bolivia</span>
        </div>
      </footer>
    </main>
  )
}
