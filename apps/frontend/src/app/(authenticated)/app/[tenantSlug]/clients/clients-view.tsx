'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { SearchInput } from '@/components/search-input'
import { ConfirmDialog } from '@/components/confirm-dialog'
import {
  IconKanban,
  IconPencil,
  IconPlus,
  IconTable,
  IconTrash,
  IconUsers,
} from '@/components/icons'
import {
  LEAD_LABELS,
  LEAD_STATUSES,
  leadBadge,
  type BuyerClient,
  type LeadStatus,
} from './client-types'

interface ClientsViewProps {
  tenantSlug: string
  tenantId: string
  initialClients: BuyerClient[]
}

type ViewMode = 'table' | 'kanban'

const VIEW_STORAGE_KEY = 'imno.clients.view'

/**
 * Interactive clients list: debounced name search, table / kanban toggle,
 * inline edit and delete, and drag-and-drop between lead stages.
 */
export function ClientsView({ tenantSlug, tenantId, initialClients }: ClientsViewProps) {
  const router = useRouter()

  const [clients, setClients] = useState<BuyerClient[]>(initialClients)
  const [view, setView] = useState<ViewMode>('table')
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [deleting, setDeleting] = useState<BuyerClient | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const [dragOver, setDragOver] = useState<LeadStatus | null>(null)

  useEffect(() => {
    const stored = window.localStorage.getItem(VIEW_STORAGE_KEY)
    if (stored === 'table' || stored === 'kanban') setView(stored)
  }, [])

  function selectView(next: ViewMode) {
    setView(next)
    window.localStorage.setItem(VIEW_STORAGE_KEY, next)
  }

  const handleSearch = useCallback(
    async (nextQuery: string) => {
      setQuery(nextQuery)
      setSearching(true)
      setError(null)

      try {
        const params = new URLSearchParams({ tenantId, limit: '100' })
        if (nextQuery) params.set('search', nextQuery)

        const response = await fetch(`/api/buyer-clients?${params.toString()}`)
        const data = await response.json()
        if (!response.ok) throw new Error(data?.message || 'No se pudo buscar')

        setClients((data.docs ?? []) as BuyerClient[])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'No se pudo buscar')
      } finally {
        setSearching(false)
      }
    },
    [tenantId],
  )

  async function changeLeadStatus(client: BuyerClient, leadStatus: LeadStatus) {
    if (client.leadStatus === leadStatus) return

    const previous = client.leadStatus
    setClients((prev) => prev.map((c) => (c.id === client.id ? { ...c, leadStatus } : c)))
    setError(null)

    try {
      const response = await fetch(`/api/buyer-clients/${client.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadStatus }),
      })
      if (!response.ok) {
        const data = await response.json().catch(() => null)
        throw new Error(data?.message || 'No se pudo mover el cliente')
      }
      router.refresh()
    } catch (err) {
      setClients((prev) =>
        prev.map((c) => (c.id === client.id ? { ...c, leadStatus: previous } : c)),
      )
      setError(err instanceof Error ? err.message : 'No se pudo mover el cliente')
    }
  }

  async function confirmDelete() {
    if (!deleting) return

    setDeleteLoading(true)
    setDeleteError(null)

    try {
      const response = await fetch(`/api/buyer-clients/${deleting.id}`, { method: 'DELETE' })
      if (!response.ok) {
        const data = await response.json().catch(() => null)
        throw new Error(data?.message || 'No se pudo eliminar el cliente')
      }

      setClients((prev) => prev.filter((c) => c.id !== deleting.id))
      setDeleting(null)
      router.refresh()
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'No se pudo eliminar el cliente')
    } finally {
      setDeleteLoading(false)
    }
  }

  const toolbar = (
    <div className="list-toolbar">
      <div className="list-toolbar-search">
        <SearchInput
          placeholder="Buscar por nombre..."
          onSearch={handleSearch}
          loading={searching}
        />
      </div>
      <div className="view-toggle" role="group" aria-label="Modo de vista">
        <button
          type="button"
          className={`view-toggle-btn${view === 'table' ? ' is-active' : ''}`}
          onClick={() => selectView('table')}
          aria-pressed={view === 'table'}
        >
          <IconTable width={16} height={16} /> Tabla
        </button>
        <button
          type="button"
          className={`view-toggle-btn${view === 'kanban' ? ' is-active' : ''}`}
          onClick={() => selectView('kanban')}
          aria-pressed={view === 'kanban'}
        >
          <IconKanban width={16} height={16} /> Kanban
        </button>
      </div>
    </div>
  )

  function actionButtons(client: BuyerClient) {
    return (
      <div className="client-actions">
        <Link href={`/app/${tenantSlug}/clients/${client.id}`} className="btn btn-secondary btn-sm">
          Ver
        </Link>
        <Link
          href={`/app/${tenantSlug}/clients/${client.id}/edit`}
          className="btn btn-secondary btn-sm"
        >
          <IconPencil width={14} height={14} /> Editar
        </Link>
        <button
          type="button"
          className="btn btn-danger btn-sm"
          onClick={() => {
            setDeleteError(null)
            setDeleting(client)
          }}
        >
          <IconTrash width={14} height={14} /> Eliminar
        </button>
      </div>
    )
  }

  return (
    <>
      {toolbar}

      {error && (
        <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
          {error}
        </div>
      )}

      {clients.length === 0 ? (
        <div className="empty-state">
          <span className="empty-state-icon">
            <IconUsers />
          </span>
          <h3>{query ? 'Sin resultados' : 'Sin clientes todavía'}</h3>
          <p className="page-subtitle" style={{ marginTop: 0 }}>
            {query
              ? `Ningún cliente coincide con "${query}".`
              : 'Añade tu primer contacto para empezar.'}
          </p>
          {!query && (
            <Link
              href={`/app/${tenantSlug}/clients/new`}
              className="btn btn-primary"
              style={{ marginTop: '0.75rem' }}
            >
              <IconPlus width={18} height={18} />
              Añadir cliente
            </Link>
          )}
        </div>
      ) : view === 'table' ? (
        <div className="table-container">
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Teléfono</th>
                  <th>Email</th>
                  <th>Estado del lead</th>
                  <th>Añadido</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {clients.map((client) => (
                  <tr key={client.id}>
                    <td>
                      <Link href={`/app/${tenantSlug}/clients/${client.id}`} className="link">
                        {client.name}
                      </Link>
                    </td>
                    <td>{client.normalizedPhone || '—'}</td>
                    <td>{client.email || '—'}</td>
                    <td>
                      <span className={`badge ${leadBadge(client.leadStatus)}`}>
                        {LEAD_LABELS[client.leadStatus]}
                      </span>
                    </td>
                    <td style={{ color: 'var(--color-text-muted)' }}>
                      {new Date(client.createdAt).toLocaleDateString()}
                    </td>
                    <td>{actionButtons(client)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="kanban">
          {LEAD_STATUSES.map((status) => {
            const columnClients = clients.filter((c) => c.leadStatus === status)

            return (
              <div
                key={status}
                className={`kanban-column${dragOver === status ? ' is-drop-target' : ''}`}
                onDragOver={(e) => {
                  e.preventDefault()
                  setDragOver(status)
                }}
                onDragLeave={() => setDragOver((prev) => (prev === status ? null : prev))}
                onDrop={(e) => {
                  e.preventDefault()
                  setDragOver(null)
                  const id = e.dataTransfer.getData('text/plain')
                  const client = clients.find((c) => String(c.id) === id)
                  if (client) void changeLeadStatus(client, status)
                }}
              >
                <div className="kanban-column-header">
                  <span className={`badge ${leadBadge(status)}`}>{LEAD_LABELS[status]}</span>
                  <span className="kanban-count">{columnClients.length}</span>
                </div>

                <div className="kanban-column-body">
                  {columnClients.length === 0 ? (
                    <p className="kanban-empty">Arrastra clientes aquí</p>
                  ) : (
                    columnClients.map((client) => (
                      <div
                        key={client.id}
                        className="kanban-card"
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData('text/plain', String(client.id))
                          e.dataTransfer.effectAllowed = 'move'
                        }}
                      >
                        <Link
                          href={`/app/${tenantSlug}/clients/${client.id}`}
                          className="kanban-card-title"
                        >
                          {client.name}
                        </Link>
                        <div className="kanban-card-meta">
                          {client.normalizedPhone && <span>{client.normalizedPhone}</span>}
                          {client.email && <span>{client.email}</span>}
                        </div>
                        {actionButtons(client)}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        title="¿Eliminar cliente?"
        description={deleting ? `Se eliminará "${deleting.name}" de forma permanente.` : undefined}
        confirmLabel="Eliminar"
        danger
        loading={deleteLoading}
        error={deleteError}
      />
    </>
  )
}
