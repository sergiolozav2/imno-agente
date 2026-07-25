import { describe, it, expect } from 'vitest'
import { loadApiConfig, findBrowserExposedSecret } from './index'

const validApiEnv: Record<string, string | undefined> = {
  APP_URL: 'http://localhost:3000',
  API_URL: 'http://localhost:3001',
  AGENT_INTERNAL_URL: 'http://localhost:3002',
  INTERNAL_SERVICE_SECRET: 'local-service-secret',
  PAYLOAD_SECRET: 'local-payload-secret',
  CLOUDFLARE_ENV: 'local',
  CLOUDFLARE_D1_BINDING: 'D1',
  CLOUDFLARE_R2_BINDING: 'R2',
}

describe('loadApiConfig', () => {
  it('returns ok for a fully valid env', () => {
    const result = loadApiConfig(validApiEnv)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.appUrl).toBe('http://localhost:3000')
      expect(result.value.d1Binding).toBe('D1')
      expect(result.value.r2Binding).toBe('R2')
    }
  })

  it('returns err with the exact missing variable name', () => {
    const missing: Record<string, string | undefined> = { ...validApiEnv }
    delete missing.PAYLOAD_SECRET
    const result = loadApiConfig(missing)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('CONFIG_INVALID')
      expect(result.error.variable).toBe('PAYLOAD_SECRET')
    }
  })

  it('treats a replace-with- placeholder as invalid', () => {
    const result = loadApiConfig({
      ...validApiEnv,
      INTERNAL_SERVICE_SECRET: 'replace-with-local-service-secret',
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.variable).toBe('INTERNAL_SERVICE_SECRET')
    }
  })
})

describe('findBrowserExposedSecret', () => {
  it('detects a NEXT_PUBLIC_ prefixed server secret', () => {
    expect(findBrowserExposedSecret({ NEXT_PUBLIC_PAYLOAD_SECRET: 'leaked' })).toBe(
      'NEXT_PUBLIC_PAYLOAD_SECRET',
    )
  })

  it('returns null when nothing sensitive is exposed', () => {
    expect(findBrowserExposedSecret({ NEXT_PUBLIC_APP_URL: 'http://localhost:3000' })).toBeNull()
  })
})
