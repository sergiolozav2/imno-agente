import { describe, it, expect } from 'vitest'
import { signInternalRequest, verifyInternalRequest } from './internal-auth'

const secret = 'local-service-secret'
const base = { method: 'POST', path: '/api/internal/agent/process', body: '{"processingId":"mp-1"}' }

describe('internal request auth', () => {
  it('verifies a freshly signed request', () => {
    const parts = signInternalRequest(secret, base)
    const result = verifyInternalRequest(secret, { ...base, ...parts })
    expect(result.ok).toBe(true)
  })

  it('rejects a tampered body', () => {
    const parts = signInternalRequest(secret, base)
    const result = verifyInternalRequest(secret, { ...base, ...parts, body: '{"processingId":"mp-2"}' })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('INTERNAL_AUTH_INVALID')
  })

  it('rejects a wrong secret', () => {
    const parts = signInternalRequest(secret, base)
    const result = verifyInternalRequest('other-secret', { ...base, ...parts })
    expect(result.ok).toBe(false)
  })

  it('rejects a stale timestamp', () => {
    const parts = signInternalRequest(secret, { ...base, timestamp: 1 })
    const result = verifyInternalRequest(secret, { ...base, ...parts }, { now: 10 * 60 * 1000 })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('INTERNAL_AUTH_INVALID')
  })
})
