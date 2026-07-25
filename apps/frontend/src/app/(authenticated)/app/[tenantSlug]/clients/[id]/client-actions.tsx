'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { IconPencil, IconTrash } from '@/components/icons'
import type { BuyerClient } from '../client-types'

interface ClientActionsProps {
  client: BuyerClient
  tenantSlug: string
}

/** Edit + delete controls shown on the client profile. */
export function ClientActions({ client, tenantSlug }: ClientActionsProps) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleDelete() {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/buyer-clients/${client.id}`, { method: 'DELETE' })
      if (!response.ok) {
        const data = await response.json().catch(() => null)
        throw new Error(data?.message || 'No se pudo eliminar el cliente')
      }

      router.push(`/app/${tenantSlug}/clients`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar el cliente')
      setLoading(false)
    }
  }

  return (
    <>
      <div className="client-actions">
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
            setError(null)
            setConfirming(true)
          }}
        >
          <IconTrash width={14} height={14} /> Eliminar
        </button>
      </div>

      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={handleDelete}
        title="¿Eliminar cliente?"
        description={`Se eliminará "${client.name}" de forma permanente.`}
        confirmLabel="Eliminar"
        danger
        loading={loading}
        error={error}
      />
    </>
  )
}
