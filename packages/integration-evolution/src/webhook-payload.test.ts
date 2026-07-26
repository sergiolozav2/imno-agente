import { describe, expect, it } from 'vitest'
import { evolutionWebhookInputSchema } from '@imno/contracts'
import { extractMessageText, normalizeEvolutionWebhookPayload } from './webhook-payload'

/** A realistic Evolution v2 `messages.upsert` envelope. */
function envelope(overrides: Record<string, unknown> = {}) {
  return {
    event: 'messages.upsert',
    instance: 'imno-agent-demo-agency',
    date_time: '2026-07-25T12:00:00.000Z',
    data: {
      key: {
        remoteJid: '59176820989@s.whatsapp.net',
        fromMe: false,
        id: 'MID123',
      },
      message: { conversation: 'hola, busco un departamento' },
      messageTimestamp: 1_700_000_000,
      ...overrides,
    },
  }
}

describe('normalizeEvolutionWebhookPayload', () => {
  it('maps the nested envelope onto the flat ingress DTO', () => {
    const parsed = evolutionWebhookInputSchema.safeParse(
      normalizeEvolutionWebhookPayload(envelope()),
    )
    expect(parsed.success).toBe(true)
    if (!parsed.success) return

    expect(parsed.data).toMatchObject({
      instanceName: 'imno-agent-demo-agency',
      eventType: 'messages.upsert',
      eventId: 'MID123',
      messageId: 'MID123',
      sender: '59176820989@s.whatsapp.net',
      fromConnectedAccount: false,
      text: 'hola, busco un departamento',
    })
  })

  it('takes the buyer from key.remoteJid, not the envelope sender', () => {
    const raw = { ...envelope(), sender: '59175034784@s.whatsapp.net' }
    const result = normalizeEvolutionWebhookPayload(raw) as { sender: string }
    // The top-level `sender` is the connected account (us), never the buyer.
    expect(result.sender).toBe('59176820989@s.whatsapp.net')
  })

  it('flags a message sent by the connected account as an outbound echo', () => {
    const raw = envelope({
      key: { remoteJid: '59176820989@s.whatsapp.net', fromMe: true, id: 'X' },
    })
    const result = normalizeEvolutionWebhookPayload(raw) as { fromConnectedAccount: boolean }
    expect(result.fromConnectedAccount).toBe(true)
  })

  it('passes an already-flat payload through unchanged', () => {
    const flat = {
      instanceName: 'imno-agent-demo-agency',
      eventType: 'messages.upsert',
      sender: '59176820989',
      fromConnectedAccount: false,
      text: 'hi',
    }
    expect(normalizeEvolutionWebhookPayload(flat)).toBe(flat)
  })

  it('converts the provider second-precision timestamp into an ISO instant', () => {
    const raw = envelope()
    delete (raw as { date_time?: unknown }).date_time
    const result = normalizeEvolutionWebhookPayload(raw) as { occurredAt: string }
    expect(result.occurredAt).toBe(new Date(1_700_000_000 * 1000).toISOString())
  })
})

describe('extractMessageText', () => {
  it('reads a plain conversation body', () => {
    expect(extractMessageText({ conversation: 'hola' })).toBe('hola')
  })

  it('reads a quoted/extended text body', () => {
    expect(extractMessageText({ extendedTextMessage: { text: 'sigo interesado' } })).toBe(
      'sigo interesado',
    )
  })

  it('falls back to image and video captions', () => {
    expect(extractMessageText({ imageMessage: { caption: 'esta foto' } })).toBe('esta foto')
    expect(extractMessageText({ videoMessage: { caption: 'este video' } })).toBe('este video')
  })

  it('returns undefined for a body it cannot read as text', () => {
    expect(extractMessageText({ audioMessage: { seconds: 3 } })).toBeUndefined()
    expect(extractMessageText(undefined)).toBeUndefined()
  })
})
