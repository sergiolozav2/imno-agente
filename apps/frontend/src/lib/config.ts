/**
 * Frontend runtime configuration. API URL is server-only.
 * Public chat uses tenant public keys, not server secrets.
 */

export function getApiUrl(): string {
  const apiUrl = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
  return apiUrl
}

export function getAppUrl(): string {
  return process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
}

export function getInternalSecret(): string {
  const secret = process.env.INTERNAL_SERVICE_SECRET
  if (!secret) {
    throw new Error('INTERNAL_SERVICE_SECRET is not configured')
  }
  return secret
}
