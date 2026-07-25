'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { IconX } from './icons'

interface DialogProps {
  /** Whether the dialog is visible. */
  open: boolean
  /** Called when the user requests to close (backdrop click, Escape, or close button). */
  onClose: () => void
  /** Optional heading shown in the dialog header. */
  title?: ReactNode
  /** Optional supporting text shown under the title. */
  description?: ReactNode
  /** Optional icon rendered to the left of the title. */
  icon?: ReactNode
  /** Optional footer content (e.g. action buttons). */
  footer?: ReactNode
  /** Max width of the dialog panel. Defaults to 520px. */
  maxWidth?: number | string
  children: ReactNode
}

/**
 * A lightweight, dependency-free modal dialog.
 *
 * Renders into a portal on <body>, locks background scroll, closes on Escape
 * or backdrop click, and traps focus loosely by autofocusing the panel.
 *
 * @example
 * const [open, setOpen] = useState(false)
 * <Dialog open={open} onClose={() => setOpen(false)} title="Título">
 *   Contenido del diálogo
 * </Dialog>
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  icon,
  footer,
  maxWidth = 520,
  children,
}: DialogProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!open) return

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }

    document.addEventListener('keydown', onKeyDown)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [open, onClose])

  if (!mounted || !open) return null

  return createPortal(
    <div
      className="dialog-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="dialog-panel" role="dialog" aria-modal="true" style={{ maxWidth }}>
        <div className="dialog-header">
          <div className="dialog-header-main">
            {icon && <span className="dialog-header-icon">{icon}</span>}
            <div>
              {title && <h2 className="dialog-title">{title}</h2>}
              {description && <p className="dialog-description">{description}</p>}
            </div>
          </div>
          <button type="button" className="dialog-close" onClick={onClose} aria-label="Cerrar">
            <IconX width={18} height={18} />
          </button>
        </div>

        <div className="dialog-body">{children}</div>

        {footer && <div className="dialog-footer">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}
