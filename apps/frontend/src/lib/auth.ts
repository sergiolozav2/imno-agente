/**
 * Authentication utilities for the frontend BFF.
 * Uses Payload's HTTP-only session cookies proxied through the same origin.
 */

import { cookies } from 'next/headers'
import { getApiUrl } from './config'

export interface AuthUser {
  id: string
  email: string
  displayName: string
}

export interface AuthSession {
  user: AuthUser
  memberships: Array<{
    tenantId: string
    tenantSlug: string
    tenantName: string
    role: 'owner' | 'member'
  }>
}

/**
 * Get the current authenticated user by calling the API's me endpoint.
 * Passes through the session cookie.
 */
export async function getSession(): Promise<AuthSession | null> {
  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get('payload-token')

  if (!sessionCookie) {
    return null
  }

  try {
    const apiUrl = getApiUrl()
    const response = await fetch(`${apiUrl}/api/auth/me`, {
      headers: {
        Cookie: `payload-token=${sessionCookie.value}`,
      },
      credentials: 'include',
    })

    if (!response.ok) {
      return null
    }

    const data = await response.json()
    return data.user ? data : null
  } catch {
    return null
  }
}

/**
 * Resolve tenant context from authenticated user and requested slug.
 * Returns null if user doesn't have membership in that tenant.
 */
export async function resolveTenant(
  tenantSlug: string,
): Promise<{ tenantId: string; role: string } | null> {
  const session = await getSession()
  if (!session) {
    return null
  }

  const membership = session.memberships.find((m) => m.tenantSlug === tenantSlug)
  if (!membership) {
    return null
  }

  return {
    tenantId: membership.tenantId,
    role: membership.role,
  }
}

/**
 * Forward auth cookies to the API in a server-side fetch.
 */
export async function authFetch(input: string, init?: RequestInit): Promise<Response> {
  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get('payload-token')

  const headers = new Headers(init?.headers)
  if (sessionCookie) {
    headers.set('Cookie', `payload-token=${sessionCookie.value}`)
  }

  const apiUrl = getApiUrl()
  const url = input.startsWith('http') ? input : `${apiUrl}${input}`

  return fetch(url, {
    ...init,
    headers,
    credentials: 'include',
  })
}
