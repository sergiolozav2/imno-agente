'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { IconUser, IconBot } from '@/components/icons'

export interface ChatMessage {
  id: string
  direction: 'inbound' | 'outbound'
  author: 'buyer' | 'ai' | 'human' | 'system'
  text: string
  createdAt: string
  deliveryState?: 'pending' | 'sent' | 'failed' | 'unknown' | null
}

function authorLabel(author: ChatMessage['author']) {
  switch (author) {
    case 'buyer':
      return 'Comprador'
    case 'ai':
      return 'IA'
    case 'human':
      return 'Agente'
    default:
      return 'Sistema'
  }
}

const POLL_INTERVAL_MS = 4000

interface MessagesPanelProps {
  tenantId: string
  conversationId: string | null
  initialMessages: ChatMessage[]
}

export function MessagesPanel({ tenantId, conversationId, initialMessages }: MessagesPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages)
  const scrollRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  // Tracks whether the user is pinned to the bottom of the scroll area.
  const pinnedToBottom = useRef(true)

  const scrollToBottom = useCallback((behavior: ScrollBehavior) => {
    bottomRef.current?.scrollIntoView({ behavior, block: 'end' })
  }, [])

  // Scroll to the newest message on first load.
  useEffect(() => {
    scrollToBottom('auto')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // When messages change, scroll to the newest only if the user was already
  // at the bottom (don't yank them away if they scrolled up to read history).
  useEffect(() => {
    if (pinnedToBottom.current) {
      scrollToBottom('smooth')
    }
  }, [messages, scrollToBottom])

  // Poll the BFF for new messages.
  useEffect(() => {
    if (!conversationId) return

    let cancelled = false

    async function poll() {
      try {
        const res = await fetch(
          `/api/messages?tenantId=${encodeURIComponent(tenantId)}&conversationId=${encodeURIComponent(conversationId as string)}&limit=100`,
          { cache: 'no-store' },
        )
        if (!res.ok || cancelled) return
        const data = await res.json()
        const docs: ChatMessage[] = Array.isArray(data?.docs) ? data.docs : []
        setMessages((prev) => (docs.length !== prev.length || hasChanged(prev, docs) ? docs : prev))
      } catch {
        // Best-effort polling; ignore transient errors.
      }
    }

    const timer = setInterval(poll, POLL_INTERVAL_MS)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [tenantId, conversationId])

  function handleScroll() {
    const el = scrollRef.current
    if (!el) return
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    pinnedToBottom.current = distanceFromBottom < 80
  }

  return (
    <div
      ref={scrollRef}
      onScroll={handleScroll}
      style={{ flex: 1, overflowY: 'auto', padding: '1.25rem', background: 'var(--color-bg)' }}
    >
      {messages.length === 0 ? (
        <div
          style={{
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <p style={{ color: 'var(--color-text-muted)', textAlign: 'center' }}>
            Sin mensajes todavía
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {messages.map((msg) => (
            <div
              key={msg.id}
              style={{
                display: 'flex',
                justifyContent: msg.direction === 'inbound' ? 'flex-start' : 'flex-end',
              }}
            >
              <div
                className={`chat-bubble ${msg.direction === 'inbound' ? 'chat-bubble-in' : 'chat-bubble-out'}`}
              >
                <p style={{ whiteSpace: 'pre-wrap' }}>{msg.text}</p>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: '0.75rem',
                    alignItems: 'center',
                    marginTop: '0.375rem',
                    fontSize: '0.6875rem',
                    opacity: 0.75,
                  }}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                    {msg.author === 'ai' ? (
                      <IconBot width={13} height={13} />
                    ) : (
                      <IconUser width={13} height={13} />
                    )}
                    {authorLabel(msg.author)}
                  </span>
                  <span>{new Date(msg.createdAt).toLocaleTimeString()}</span>
                </div>
                {msg.direction === 'outbound' && msg.deliveryState && (
                  <div style={{ fontSize: '0.625rem', opacity: 0.6, marginTop: '0.25rem' }}>
                    {msg.deliveryState}
                  </div>
                )}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      )}
    </div>
  )
}

function hasChanged(prev: ChatMessage[], next: ChatMessage[]): boolean {
  for (let i = 0; i < next.length; i++) {
    const a = prev[i]
    const b = next[i]
    if (!a || a.id !== b.id || a.text !== b.text || a.deliveryState !== b.deliveryState) {
      return true
    }
  }
  return false
}
