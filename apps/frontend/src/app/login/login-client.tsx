'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { IconArrowLeft } from '@/components/icons'

export function Login() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.message || 'Error al iniciar sesión')
        setLoading(false)
        return
      }

      if (data.memberships && data.memberships.length > 0) {
        router.push(`/app/${data.memberships[0].tenantSlug}/properties`)
      } else {
        setError('No se encontraron membresías para esta cuenta')
        setLoading(false)
      }
    } catch {
      setError('No se pudo conectar con el servidor')
      setLoading(false)
    }
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
        background:
          'radial-gradient(1200px 600px at 100% -10%, var(--color-brand-100), transparent), var(--color-bg)',
      }}
    >
      <div style={{ width: '100%', maxWidth: '410px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.625rem',
            marginBottom: '1.5rem',
          }}
        >
          <span className="sidebar-logo" style={{ background: 'var(--color-primary)' }}>
            IA
          </span>
          <span style={{ fontWeight: 700, fontSize: '1.125rem' }}>Imno Agente</span>
        </div>

        <div className="card" style={{ boxShadow: 'var(--shadow-lg)' }}>
          <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
            <h1 style={{ fontSize: '1.375rem', marginBottom: '0.25rem' }}>Inicia sesión</h1>
            <p className="page-subtitle" style={{ marginTop: 0 }}>
              Accede al panel de tu agencia
            </p>
          </div>

          {error && (
            <div className="alert alert-error" role="alert" style={{ marginBottom: '1.25rem' }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                type="email"
                className="form-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="propietario@ejemplo.com"
                required
                autoComplete="email"
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="password">
                Contraseña
              </label>
              <input
                id="password"
                type="password"
                className="form-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Introduce tu contraseña"
                required
                autoComplete="current-password"
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-block"
              style={{ marginTop: '0.5rem' }}
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="spinner" /> Iniciando sesión...
                </>
              ) : (
                'Entrar'
              )}
            </button>
          </form>

          <div
            className="alert"
            style={{ marginTop: '1.5rem', flexDirection: 'column', gap: '0.375rem' }}
          >
            <p style={{ fontSize: '0.8125rem', fontWeight: 600 }}>Credenciales de demostración</p>
            <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
              Sunshine: <span className="kbd">sunshine@demo.local</span> /{' '}
              <span className="kbd">demo123</span>
            </p>
            <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
              Moonlight: <span className="kbd">moonlight@demo.local</span> /{' '}
              <span className="kbd">demo123</span>
            </p>
          </div>
        </div>

        <div style={{ marginTop: '1.25rem', textAlign: 'center' }}>
          <Link href="/" className="breadcrumb" style={{ marginBottom: 0 }}>
            <IconArrowLeft width={16} height={16} /> Volver al inicio
          </Link>
        </div>
      </div>
    </main>
  )
}
