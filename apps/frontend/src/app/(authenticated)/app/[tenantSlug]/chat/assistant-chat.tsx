'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { IconPlus, IconSend } from '@/components/icons'

/**
 * Operator chat with the system agent.
 *
 * Same agent the platform WhatsApp line talks to, so a session started here is
 * visible from there and vice versa. A turn is a single blocking request: the
 * agent may run up to a dozen tool steps before it answers, so the wait can run
 * into tens of seconds and the composer stays disabled until it returns.
 */

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  text: string
  toolCalls?: string[]
}

interface SessionSummary {
  threadId: string
  title: string
  updatedAt: string
}

/** Tool keys arrive as `findPropertiesTool`; show them as "find properties". */
function toolLabel(key: string): string {
  return key
    .replace(/Tool$/, '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase()
}

const SUGGESTIONS = [
  '¿Qué propiedades tengo publicadas en este momento?',
  'Muéstrame los leads calientes de esta semana',
  'Genera contenido para redes de mi propiedad más cara',
  'Crea un vídeo de mi propiedad más cara',
]

/**
 * The agent hands back a plain markdown link to a rendered reel, because that is
 * also what WhatsApp needs. Here we can do better: a link whose target is an MP4
 * becomes a player, so the operator can watch the video without leaving the chat.
 */
function ChatLink({
  href,
  children,
}: {
  href?: string
  children?: React.ReactNode
}) {
  if (href && /\.mp4(\?|$)/i.test(href)) {
    return (
      <video
        src={href}
        controls
        preload="metadata"
        playsInline
        className="chat-video"
        aria-label={typeof children === 'string' ? children : 'Vídeo de la propiedad'}
      />
    )
  }
  return (
    <a href={href} target="_blank" rel="noreferrer">
      {children}
    </a>
  )
}

export function AssistantChat({ tenantSlug, userName }: { tenantSlug: string; userName: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [threadId, setThreadId] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [loadingSession, setLoadingSession] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const refreshSessions = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/agent/sessions?tenantSlug=${encodeURIComponent(tenantSlug)}`,
      )
      if (!response.ok) return
      const data = await response.json()
      setSessions(Array.isArray(data.sessions) ? data.sessions : [])
    } catch {
      // A missing session list never blocks chatting.
    }
  }, [tenantSlug])

  useEffect(() => {
    refreshSessions()
  }, [refreshSessions])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, sending])

  function startNewChat() {
    setThreadId(null)
    setMessages([])
    inputRef.current?.focus()
  }

  async function openSession(id: string) {
    if (id === threadId || sending) return
    setLoadingSession(true)
    setThreadId(id)
    setMessages([])
    try {
      const response = await fetch(
        `/api/agent/sessions?tenantSlug=${encodeURIComponent(tenantSlug)}&threadId=${encodeURIComponent(id)}`,
      )
      if (!response.ok) throw new Error('not found')
      const data = await response.json()
      const loaded: ChatMessage[] = (data.messages ?? []).map(
        (message: { role: string; text: string }, index: number) => ({
          id: `${id}-${index}`,
          role: message.role === 'user' ? 'user' : 'assistant',
          text: message.text,
        }),
      )
      setMessages(loaded)
    } catch {
      setMessages([
        { id: 'load-error', role: 'assistant', text: 'No pude cargar esta conversación.' },
      ])
    } finally {
      setLoadingSession(false)
    }
  }

  async function send(text: string) {
    const trimmed = text.trim()
    if (!trimmed || sending) return

    setInput('')
    setSending(true)
    setMessages((prev) => [...prev, { id: `u-${Date.now()}`, role: 'user', text: trimmed }])

    const isNewSession = threadId === null

    try {
      const response = await fetch('/api/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantSlug, message: trimmed, threadId }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message ?? 'failed')

      if (data.threadId) setThreadId(data.threadId)
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: 'assistant',
          text: data.text,
          toolCalls: data.toolCalls ?? [],
        },
      ])
      if (isNewSession) refreshSessions()
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `e-${Date.now()}`,
          role: 'assistant',
          text: 'Hubo un error al contactar al asistente. Inténtalo de nuevo.',
        },
      ])
    } finally {
      setSending(false)
      inputRef.current?.focus()
    }
  }

  const greeting = userName ? `Hola, ${userName.split(' ')[0]}` : 'Hola'

  return (
    <div className="assistant-shell">
      <aside className="assistant-sessions">
        <button type="button" className="btn btn-primary" onClick={startNewChat}>
          <IconPlus width={16} height={16} />
          Nueva conversación
        </button>
        <span className="text-stone-950 sidebar-section-label">Historial</span>
        <div className="assistant-session-list">
          {sessions.length === 0 && (
            <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', padding: '0.5rem' }}>
              Aún no hay conversaciones.
            </p>
          )}
          {sessions.map((session) => (
            <button
              key={session.threadId}
              type="button"
              className={`assistant-session${session.threadId === threadId ? ' is-active' : ''}`}
              onClick={() => openSession(session.threadId)}
              title={session.title}
            >
              {session.title}
            </button>
          ))}
        </div>
      </aside>

      <div className="chat-panel" style={{ minHeight: 0 }}>
        <div className="chat-header">
          <h2 style={{ fontSize: '1rem', color: '#fff' }}>Asistente</h2>
          <p style={{ fontSize: '0.75rem', opacity: 0.9 }}>
            Propiedades, clientes, conversaciones y contenido
          </p>
        </div>

        <div className="chat-body">
          {messages.length === 0 && !loadingSession && (
            <div style={{ margin: 'auto 0', textAlign: 'center', padding: '1rem' }}>
              <p style={{ fontWeight: 600, marginBottom: '0.375rem' }}>{greeting}</p>
              <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
                Pídeme algo sobre tu inventario, tus leads o tus conversaciones.
              </p>
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '0.5rem',
                  justifyContent: 'center',
                  marginTop: '1rem',
                }}
              >
                {SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    className="btn btn-secondary"
                    style={{ fontSize: '0.75rem' }}
                    onClick={() => send(suggestion)}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          {loadingSession && (
            <p
              style={{
                margin: 'auto',
                fontSize: '0.8125rem',
                color: 'var(--color-text-muted)',
              }}
            >
              Cargando conversación...
            </p>
          )}

          {messages.map((message) => (
            <div
              key={message.id}
              className={`chat-bubble ${message.role === 'user' ? 'chat-bubble-out' : 'chat-bubble-in'}`}
            >
              {message.role === 'assistant' ? (
                <div className="chat-markdown">
                  <Markdown remarkPlugins={[remarkGfm]} components={{ a: ChatLink }}>
                    {message.text}
                  </Markdown>
                </div>
              ) : (
                <p style={{ whiteSpace: 'pre-wrap' }}>{message.text}</p>
              )}
              {message.toolCalls && message.toolCalls.length > 0 && (
                <div className="assistant-tools">
                  {Array.from(new Set(message.toolCalls)).map((tool) => (
                    <span key={tool} className="assistant-tool-chip">
                      {toolLabel(tool)}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}

          {sending && (
            <div
              className="chat-bubble chat-bubble-in"
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <span
                className="spinner"
                style={{ width: '0.75rem', height: '0.75rem', color: 'var(--color-text-muted)' }}
              />
              <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                Pensando...
              </span>
            </div>
          )}

          <div ref={endRef} />
        </div>

        <div className="chat-input-row">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                send(input)
              }
            }}
            placeholder="Escribe tu mensaje..."
            disabled={sending}
            className="form-input"
            style={{ flex: 1 }}
          />
          <button
            type="button"
            onClick={() => send(input)}
            disabled={!input.trim() || sending}
            className="btn btn-primary btn-icon"
            aria-label="Enviar mensaje"
          >
            <IconSend width={18} height={18} />
          </button>
        </div>
      </div>
    </div>
  )
}
