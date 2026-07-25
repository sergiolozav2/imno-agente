import { describe, it, expect } from 'vitest'
import { normalizePhone, stripWhatsAppSuffix } from './phone'

describe('normalizePhone', () => {
  it('normalizes a national number using tenant country context', () => {
    const result = normalizePhone('600 123 456', 'ES')
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.e164).toBe('+34600123456')
  })

  it('accepts an already-international E.164 number', () => {
    const result = normalizePhone('+34600123456', 'ES')
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.e164).toBe('+34600123456')
  })

  it('normalizes a full-international WhatsApp JID regardless of tenant country', () => {
    // Regression: a Bolivian (+591) buyer messaging an ES tenant must not be
    // parsed as a Spanish number (which corrupts it into an invalid +3459...).
    const result = normalizePhone('59176820989@s.whatsapp.net', 'ES')
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.e164).toBe('+59176820989')
  })

  it('rejects empty input with INVALID_PHONE', () => {
    const result = normalizePhone('', 'ES')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('INVALID_PHONE')
  })

  it('rejects an obviously invalid number', () => {
    const result = normalizePhone('12', 'ES')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('INVALID_PHONE')
  })

  it('strips WhatsApp provider suffixes before parsing', () => {
    expect(stripWhatsAppSuffix('34600123456@s.whatsapp.net')).toBe('34600123456')
    expect(stripWhatsAppSuffix('34600123456:12@s.whatsapp.net')).toBe('34600123456')
    const result = normalizePhone('34600123456@s.whatsapp.net', 'ES')
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.e164).toBe('+34600123456')
  })

  it('allows the same normalized phone to be produced for different tenants', () => {
    const a = normalizePhone('600123456', 'ES')
    const b = normalizePhone('+34600123456', 'ES')
    expect(a.ok && b.ok && a.value.e164 === b.value.e164).toBe(true)
    // Per-tenant uniqueness is enforced at the persistence layer via
    // (tenantId, e164); the normalizer itself is tenant-agnostic on output.
  })
})
