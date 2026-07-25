import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'

const cookieSet = vi.hoisted(() => vi.fn())

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({ set: cookieSet })),
}))

vi.mock('@/lib/config', () => ({
  getApiUrl: () => 'http://fixture-api.invalid',
}))

import { POST } from './route'

describe('Property 1: login membership-resolution bug condition', () => {
  const persistedAuthorizedMemberships = [
    { tenantId: '10', tenantSlug: 'fixture-tenant', tenantName: 'Fixture Tenant', role: 'owner' },
  ]

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
    cookieSet.mockClear()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('does not turn a failed resolver into a successful empty membership session', async () => {
    const fetchMock = vi.mocked(fetch)
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            user: { id: '1', email: 'fixture@example.test', displayName: 'Fixture User' },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ code: 'MEMBERSHIP_RESOLUTION_FAILED' }), {
          status: 503,
          headers: { 'content-type': 'application/json' },
        }),
      )

    const response = await POST(
      new Request('http://frontend.invalid/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'fixture@example.test', password: 'fixture-only' }),
        headers: { 'content-type': 'application/json' },
      }),
    )
    const body = await response.json()

    // The fixture represents a user with one persisted authorized membership;
    // resolver failure must not be reported as the valid empty-membership state.
    expect(persistedAuthorizedMemberships).toHaveLength(1)
    expect(response.status).not.toBe(200)
    expect(body.memberships).not.toEqual([])
    expect(cookieSet).not.toHaveBeenCalled()
  })
})
