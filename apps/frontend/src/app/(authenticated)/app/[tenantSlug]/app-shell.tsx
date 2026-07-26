'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import {
  IconChat,
  IconBuilding,
  IconUsers,
  IconInbox,
  IconSparkles,
  IconIntegrations,
  IconMenu,
  IconX,
  IconChevronsLeft,
  IconLogout,
} from '@/components/icons'

interface AppShellProps {
  tenantSlug: string
  tenantName: string
  user: { displayName: string; email: string }
  children: React.ReactNode
}

export function AppShell({ tenantSlug, tenantName, user, children }: AppShellProps) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  const navItems = [
    { href: `/app/${tenantSlug}/chat`, label: 'Asistente', icon: IconChat },
    { href: `/app/${tenantSlug}/properties`, label: 'Propiedades', icon: IconBuilding },
    { href: `/app/${tenantSlug}/clients`, label: 'Clientes', icon: IconUsers },
    { href: `/app/${tenantSlug}/conversations`, label: 'Conversaciones', icon: IconInbox },
    { href: `/app/${tenantSlug}/content`, label: 'Contenido', icon: IconSparkles },
    {
      href: `/app/${tenantSlug}/settings/integrations`,
      label: 'Integraciones',
      icon: IconIntegrations,
    },
  ]

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  const initials = tenantName
    ?.split(' ')
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()

  const userInitials = user.displayName
    ?.split(' ')
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <div className="app-shell">
      <aside
        className={`sidebar${collapsed ? ' is-collapsed' : ''}${mobileOpen ? ' is-open' : ''}`}
      >
        <div className="sidebar-brand">
          <span className="sidebar-logo">{initials || 'IA'}</span>
          <span className="sidebar-brand-text">
            <span className="sidebar-brand-name">{tenantName}</span>
            <span className="sidebar-brand-sub">Imno Agente</span>
          </span>
        </div>

        <nav className="sidebar-nav" aria-label="Principal">
          <span className="sidebar-section-label">Espacio de trabajo</span>
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`sidebar-link${isActive ? ' is-active' : ''}`}
                title={item.label}
                aria-current={isActive ? 'page' : undefined}
              >
                <Icon />
                <span className="sidebar-link-label">{item.label}</span>
              </Link>
            )
          })}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <span className="sidebar-avatar">{userInitials || 'U'}</span>
            <span className="sidebar-user-meta">
              <span className="sidebar-user-name">{user.displayName}</span>
              <span className="sidebar-user-email">{user.email}</span>
            </span>
          </div>
          <form action="/api/auth/logout" method="POST" style={{ marginTop: '0.5rem' }}>
            <button
              type="submit"
              className="sidebar-link"
              style={{ width: '100%', border: 'none', cursor: 'pointer' }}
            >
              <IconLogout />
              <span className="sidebar-link-label">Cerrar sesión</span>
            </button>
          </form>
          <button
            type="button"
            className="sidebar-link collapse-toggle"
            onClick={() => setCollapsed((c) => !c)}
            style={{ width: '100%', border: 'none', cursor: 'pointer' }}
            title={collapsed ? 'Expandir' : 'Contraer'}
          >
            <IconChevronsLeft
              style={{
                transform: collapsed ? 'rotate(180deg)' : 'none',
                transition: 'transform 0.2s ease',
              }}
            />
            <span className="sidebar-link-label">Contraer</span>
          </button>
        </div>
      </aside>

      <div
        className={`sidebar-backdrop${mobileOpen ? ' is-open' : ''}`}
        onClick={() => setMobileOpen(false)}
        aria-hidden="true"
      />

      <div className={`app-main${collapsed ? ' is-collapsed' : ''}`}>
        <header className="app-topbar">
          <button
            type="button"
            className="icon-btn"
            onClick={() => setMobileOpen((o) => !o)}
            aria-label={mobileOpen ? 'Cerrar menú' : 'Abrir menú'}
          >
            {mobileOpen ? <IconX /> : <IconMenu />}
          </button>
          <span className="sidebar-logo">{initials || 'IA'}</span>
          <span style={{ fontWeight: 650, fontSize: '0.9375rem' }}>{tenantName}</span>
        </header>

        <div className="app-content">{children}</div>
      </div>
    </div>
  )
}
