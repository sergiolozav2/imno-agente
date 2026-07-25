'use client'

import { useState, useEffect, useRef } from 'react'
import { IconSend } from '@/components/icons'

interface ChatMessage {
  id: string
  role: 'user' | 'agent'
  content: string
  timestamp: Date
}

interface ChatProps {
  tenantId: string
  tenantName: string
  publicChatKey: string
}

export function Chat({ tenantName, publicChatKey }: ChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [sessionId] = useState(
    () => `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  )
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function sendMessage() {
    if (!input.trim() || loading) return

    const userMessage = input.trim()
    setInput('')
    setLoading(true)

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: userMessage,
      timestamp: new Date(),
    }
    setMessages((prev) => [...prev, userMsg])

    try {
      const response = await fetch('/api/public-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publicChatKey, message: userMessage, sessionId }),
      })

      if (!response.ok) {
        throw new Error('Failed to send message')
      }

      const data = await response.json()

      const agentMsg: ChatMessage = {
        id: `agent-${Date.now()}`,
        role: 'agent',
        content:
          data.reply || data.message || 'Gracias por tu mensaje. Un agente te responderá en breve.',
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, agentMsg])
    } catch {
      const errorMsg: ChatMessage = {
        id: `error-${Date.now()}`,
        role: 'agent',
        content: 'Lo sentimos, hubo un error al enviar tu mensaje. Inténtalo de nuevo.',
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, errorMsg])
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="chat-panel" style={{ width: '100%', maxWidth: '480px', height: '640px' }}>
      <div className="chat-header">
        <h2 style={{ fontSize: '1rem', color: '#fff' }}>{tenantName}</h2>
        <p style={{ fontSize: '0.75rem', opacity: 0.9 }}>Asistente inmobiliario</p>
      </div>

      <div className="chat-body">
        {messages.length === 0 && (
          <div
            style={{
              textAlign: 'center',
              padding: '2rem 1rem',
              color: 'var(--color-text-muted)',
              margin: 'auto 0',
            }}
          >
            <p style={{ fontWeight: 600, color: 'var(--color-text)', marginBottom: '0.375rem' }}>
              Hola
            </p>
            <p style={{ fontSize: '0.875rem' }}>
              Pregúntame por propiedades disponibles, precios o agenda una visita.
            </p>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            style={{
              display: 'flex',
              justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
            }}
          >
            <div
              className={`chat-bubble ${msg.role === 'user' ? 'chat-bubble-out' : 'chat-bubble-in'}`}
            >
              <p style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</p>
              <p
                style={{
                  fontSize: '0.625rem',
                  opacity: 0.7,
                  marginTop: '0.25rem',
                  textAlign: msg.role === 'user' ? 'right' : 'left',
                }}
              >
                {msg.timestamp.toLocaleTimeString()}
              </p>
            </div>
          </div>
        ))}

        {loading && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div
              className="chat-bubble chat-bubble-in"
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <span
                className="spinner"
                style={{ width: '0.75rem', height: '0.75rem', color: 'var(--color-text-muted)' }}
              />
              <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                Escribiendo...
              </span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="chat-input-row">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Escribe tu mensaje..."
          disabled={loading}
          className="form-input"
          style={{ flex: 1 }}
        />
        <button
          onClick={sendMessage}
          disabled={!input.trim() || loading}
          className="btn btn-primary btn-icon"
          aria-label="Enviar mensaje"
        >
          <IconSend width={18} height={18} />
        </button>
      </div>
    </div>
  )
}
