'use client'

import type { ReactNode } from 'react'
import { Dialog } from './dialog'

interface ConfirmDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: ReactNode
  description?: ReactNode
  /** Label for the confirm button. Defaults to "Confirmar". */
  confirmLabel?: string
  cancelLabel?: string
  /** Renders the confirm button in the danger style. */
  danger?: boolean
  loading?: boolean
  error?: string | null
  children?: ReactNode
}

/**
 * Small confirmation modal for destructive or irreversible actions.
 *
 * @example
 * <ConfirmDialog open={open} onClose={close} onConfirm={remove}
 *   title="¿Eliminar cliente?" danger confirmLabel="Eliminar" />
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  danger = false,
  loading = false,
  error = null,
  children,
}: ConfirmDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      maxWidth={440}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="spinner" /> Procesando...
              </>
            ) : (
              confirmLabel
            )}
          </button>
        </>
      }
    >
      {error && (
        <div className="alert alert-error" style={{ marginBottom: children ? '1rem' : 0 }}>
          {error}
        </div>
      )}
      {children}
    </Dialog>
  )
}
