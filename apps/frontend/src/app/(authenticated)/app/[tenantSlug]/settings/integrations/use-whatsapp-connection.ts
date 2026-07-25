'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

export type WhatsAppConnectionState = 'connecting' | 'qr_required' | 'connected' | 'disconnected'

export interface WhatsAppInstance {
  id: string
  instanceName: string
  externalInstanceId?: string
  connectionState: WhatsAppConnectionState
  webhookState?: 'configured' | 'pending' | 'failed'
}

/** How often to re-check the live connection state with Evolution. */
const POLL_INTERVAL_MS = 10_000

export interface WhatsAppConnection {
  instance: WhatsAppInstance | null
  qrCode: string | null
  /** True while a user-initiated action (create / manual refresh) is in flight. */
  loading: boolean
  /** True until the first live status check has resolved. */
  checking: boolean
  error: string | null
  createInstance: () => Promise<void>
  fetchQrCode: (name?: string) => Promise<void>
  refreshStatus: () => Promise<void>
}

/**
 * Owns the WhatsApp instance state and keeps it in sync with the live Evolution
 * connection state.
 *
 * The persisted `connectionState` in the database is not reliable (it can go
 * stale when the session changes outside our webhooks), so the live status
 * endpoint is treated as the source of truth: it is polled on mount and then on
 * an interval. This hook is intentionally held by the parent of both the
 * integration card and the setup dialog so they always show the same state.
 */
export function useWhatsAppConnection(
  tenantId: string,
  tenantSlug: string,
  existingInstance: WhatsAppInstance | null,
): WhatsAppConnection {
  const [instance, setInstance] = useState<WhatsAppInstance | null>(existingInstance)
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(Boolean(existingInstance?.instanceName))
  const [error, setError] = useState<string | null>(null)

  // Keep the latest instance name in a ref so the polling effect doesn't need
  // to tear down and restart every time the instance object changes.
  const instanceNameRef = useRef<string | undefined>(existingInstance?.instanceName)
  useEffect(() => {
    instanceNameRef.current = instance?.instanceName
  }, [instance?.instanceName])

  const readLiveState = useCallback(async (): Promise<WhatsAppConnectionState | null> => {
    const instanceName = instanceNameRef.current
    if (!instanceName) return null

    try {
      const response = await fetch(
        `/api/whatsapp/status?instanceName=${encodeURIComponent(instanceName)}`,
      )
      if (!response.ok) return null

      const data = await response.json()
      const state = data.state as WhatsAppConnectionState | undefined
      if (!state) return null

      setInstance((prev) => (prev ? { ...prev, connectionState: state } : prev))
      // A live session means any previously fetched QR is no longer meaningful.
      if (state === 'connected') setQrCode(null)

      return state
    } catch {
      // Swallow — the caller can retry, and polling will try again.
      return null
    }
  }, [])

  const fetchQrCode = useCallback(async (name?: string) => {
    const instanceName = name ?? instanceNameRef.current
    if (!instanceName) return

    try {
      const response = await fetch(
        `/api/whatsapp/qr?instanceName=${encodeURIComponent(instanceName)}`,
      )
      if (!response.ok) return

      const data = await response.json()
      setQrCode(data.qr)
      setInstance((prev) => (prev ? { ...prev, connectionState: 'qr_required' } : prev))
    } catch {
      // Ignore QR fetch errors
    }
  }, [])

  // Sync live state on mount, then poll so the UI reflects reality rather than
  // the stale persisted value.
  useEffect(() => {
    if (!instanceNameRef.current) {
      setChecking(false)
      return
    }

    let cancelled = false
    ;(async () => {
      await readLiveState()
      if (!cancelled) setChecking(false)
    })()

    const timer = setInterval(() => {
      if (document.visibilityState === 'hidden') return
      void readLiveState()
    }, POLL_INTERVAL_MS)

    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [readLiveState])

  const createInstance = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/whatsapp/ensure-instance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, tenantSlug }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.message || 'No se pudo crear la instancia')
      }

      setInstance(data.instance)
      instanceNameRef.current = data.instance?.instanceName

      if (
        data.instance?.instanceName &&
        (data.instance?.connectionState === 'qr_required' ||
          data.instance?.connectionState === 'connecting')
      ) {
        await fetchQrCode(data.instance.instanceName)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear la instancia')
    } finally {
      setLoading(false)
    }
  }, [tenantId, tenantSlug, fetchQrCode])

  const refreshStatus = useCallback(async () => {
    if (!instanceNameRef.current) return

    setLoading(true)
    try {
      await readLiveState()
    } finally {
      setLoading(false)
    }
  }, [readLiveState])

  return { instance, qrCode, loading, checking, error, createInstance, fetchQrCode, refreshStatus }
}
