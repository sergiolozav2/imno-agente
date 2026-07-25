import { describe, it, expect } from 'vitest'
import { inboundMessageSchema } from './messaging'
import { evolutionWebhookInputSchema } from './ingress'
import { ok, err, isOk, isErr } from './result'

describe('shared message contract', () => {
  it('accepts a well-formed inbound message', () => {
    const parsed = inboundMessageSchema.safeParse({
      schemaVersion: 1,
      tenantId: 't1',
      channel: 'whatsapp',
      conversationId: 'c1',
      contact: { clientId: 'cl1', normalizedPhone: '+34911111111' },
      content: { kind: 'text', text: 'hola' },
      occurredAt: new Date().toISOString(),
      provider: { adapter: 'evolution', eventId: 'e1', messageId: 'm1', instanceId: 'i1' },
      idempotencyKey: 'evolution:i1:e1',
    })
    expect(parsed.success).toBe(true)
  })

  it('rejects a message missing tenant', () => {
    const parsed = inboundMessageSchema.safeParse({
      schemaVersion: 1,
      channel: 'whatsapp',
    })
    expect(parsed.success).toBe(false)
  })
})

describe('untrusted ingress DTO', () => {
  it('keeps provider fields but never a tenant id', () => {
    const parsed = evolutionWebhookInputSchema.parse({
      instanceName: 'imno-agent-sunshine-realty',
      eventType: 'messages.upsert',
      eventId: 'evt-1',
      sender: '34911111111@s.whatsapp.net',
      fromConnectedAccount: false,
      text: 'hola',
    })
    expect(parsed).not.toHaveProperty('tenantId')
    expect(parsed.instanceName).toContain('sunshine-realty')
  })
})

describe('result helpers', () => {
  it('narrows ok and err', () => {
    expect(isOk(ok(1))).toBe(true)
    expect(isErr(err('x'))).toBe(true)
  })
})
