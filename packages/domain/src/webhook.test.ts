import { describe, it, expect } from 'vitest'
import {
  decideWebhook,
  deriveEventKey,
  isAcceptedEventType,
  isOutboundEcho,
  verifyWebhookAuth,
} from './webhook'
import type { EvolutionWebhookInput } from '@imno/contracts'

const base: EvolutionWebhookInput = {
  instanceName: 'imno-agent-sunshine-realty',
  eventType: 'messages.upsert',
  eventId: 'evt-1',
  messageId: 'msg-1',
  sender: '34600123456@s.whatsapp.net',
  fromConnectedAccount: false,
  text: 'hola',
}

describe('webhook auth', () => {
  it('rejects a wrong secret', () => {
    expect(verifyWebhookAuth('nope', 'expected')).toBe(false)
  })
  it('accepts a matching secret (constant-time)', () => {
    expect(verifyWebhookAuth('expected', 'expected')).toBe(true)
  })
  it('rejects empty secrets', () => {
    expect(verifyWebhookAuth('', 'expected')).toBe(false)
    expect(verifyWebhookAuth('x', '')).toBe(false)
  })
})

describe('event filtering', () => {
  it('accepts messages.upsert', () => {
    expect(isAcceptedEventType('messages.upsert')).toBe(true)
  })
  it('ignores unrelated event types', () => {
    expect(isAcceptedEventType('connection.update')).toBe(false)
  })
})

describe('echo detection', () => {
  it('flags product-originated outbound echoes', () => {
    expect(isOutboundEcho({ fromConnectedAccount: true })).toBe(true)
    expect(isOutboundEcho({ fromConnectedAccount: false })).toBe(false)
  })
})

describe('deduplication key', () => {
  it('is stable for the same provider event', () => {
    expect(deriveEventKey(base)).toBe(deriveEventKey({ ...base }))
  })
  it('derives a deterministic hash when no stable id is present', () => {
    const noId = { ...base, eventId: undefined, messageId: undefined }
    const key = deriveEventKey(noId)
    expect(key).toBe(deriveEventKey({ ...noId }))
    expect(key).toContain(':h:')
  })
})

describe('decideWebhook sequence', () => {
  it('rejects unauthorized before anything else', () => {
    const d = decideWebhook({ input: base, providedSecret: 'bad', expectedSecret: 'good' })
    expect(d.action).toBe('reject-unauthorized')
  })
  it('acknowledges unaccepted event types without processing', () => {
    const d = decideWebhook({
      input: { ...base, eventType: 'connection.update' },
      providedSecret: 'good',
      expectedSecret: 'good',
    })
    expect(d).toEqual({ action: 'acknowledge-ignored', reason: 'unaccepted-event' })
  })
  it('acknowledges echoes without creating buyer messages', () => {
    const d = decideWebhook({
      input: { ...base, fromConnectedAccount: true },
      providedSecret: 'good',
      expectedSecret: 'good',
    })
    expect(d).toEqual({ action: 'acknowledge-ignored', reason: 'echo' })
  })
  it('processes a valid accepted inbound event with a stable key', () => {
    const d = decideWebhook({ input: base, providedSecret: 'good', expectedSecret: 'good' })
    expect(d.action).toBe('process')
    if (d.action === 'process') expect(d.eventKey).toContain('sunshine-realty')
  })
})
