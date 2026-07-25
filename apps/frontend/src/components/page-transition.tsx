'use client'

import { usePathname, useSearchParams } from 'next/navigation'
import { Suspense, useCallback, useEffect, useRef, useState } from 'react'

type TransitionPhase = 'idle' | 'loading' | 'complete'

const COMPLETE_DURATION_MS = 320
const STALE_TRANSITION_TIMEOUT_MS = 30_000

function PageTransitionInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const routeKey = `${pathname}?${searchParams.toString()}`
  const [phase, setPhase] = useState<TransitionPhase>('idle')
  const activeRef = useRef(false)
  const completeTimeoutRef = useRef<number | null>(null)
  const staleTimeoutRef = useRef<number | null>(null)

  const clearTimeouts = useCallback(() => {
    if (completeTimeoutRef.current !== null) {
      window.clearTimeout(completeTimeoutRef.current)
      completeTimeoutRef.current = null
    }

    if (staleTimeoutRef.current !== null) {
      window.clearTimeout(staleTimeoutRef.current)
      staleTimeoutRef.current = null
    }
  }, [])

  const startTransition = useCallback(() => {
    clearTimeouts()
    activeRef.current = true
    setPhase('loading')

    staleTimeoutRef.current = window.setTimeout(() => {
      activeRef.current = false
      staleTimeoutRef.current = null
      setPhase('idle')
    }, STALE_TRANSITION_TIMEOUT_MS)
  }, [clearTimeouts])

  const completeTransition = useCallback(() => {
    if (!activeRef.current) return

    activeRef.current = false

    if (staleTimeoutRef.current !== null) {
      window.clearTimeout(staleTimeoutRef.current)
      staleTimeoutRef.current = null
    }

    setPhase('complete')
    completeTimeoutRef.current = window.setTimeout(() => {
      completeTimeoutRef.current = null
      setPhase('idle')
    }, COMPLETE_DURATION_MS)
  }, [])

  useEffect(() => {
    completeTransition()
  }, [routeKey, completeTransition])

  useEffect(() => {
    const handleNavigationClick = (event: MouseEvent) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return
      }

      const target = event.target
      if (!(target instanceof Element)) return

      const anchor = target.closest('a[href]')
      if (!(anchor instanceof HTMLAnchorElement)) return
      if (anchor.hasAttribute('download')) return
      if (anchor.target && anchor.target !== '_self') return

      const currentUrl = new URL(window.location.href)
      const destinationUrl = new URL(anchor.href, currentUrl)

      if (destinationUrl.origin !== currentUrl.origin) return
      if (
        destinationUrl.pathname === currentUrl.pathname &&
        destinationUrl.search === currentUrl.search
      ) {
        return
      }

      startTransition()
    }

    window.addEventListener('popstate', startTransition)
    document.addEventListener('click', handleNavigationClick, true)

    return () => {
      window.removeEventListener('popstate', startTransition)
      document.removeEventListener('click', handleNavigationClick, true)
      clearTimeouts()
    }
  }, [clearTimeouts, startTransition])

  const isLoading = phase === 'loading'
  const status = isLoading ? 'Cargando página' : phase === 'complete' ? 'Página cargada' : ''

  return (
    <>
      <div
        className="navigation-progress"
        data-phase={phase}
        role={phase === 'idle' ? undefined : 'progressbar'}
        aria-label={phase === 'idle' ? undefined : status}
      >
        <div className="navigation-progress__bar" />
      </div>
      <span className="sr-only" role="status" aria-live="polite">
        {status}
      </span>
      <div aria-busy={isLoading || undefined}>{children}</div>
    </>
  )
}

export function PageTransition({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div>{children}</div>}>
      <PageTransitionInner>{children}</PageTransitionInner>
    </Suspense>
  )
}
