import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const cookieSet = vi.hoisted(() => vi.fn())

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({ set: cookieSet })),
}))

vi.mock('@/lib/config', () => ({
  getApiUrl: () => 'http://fixture-api.invalid',
}))

import { POST } from './route'

describe('Property 2: empty session preservation', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
    cookieSet.mockClear()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('preserves a successful zero-membership session as an explicit empty projection', async () => {
    const fetchMock = vi.mocked(fetch)
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            token: 'fixture-token',
            user: { id: '1', email: 'empty@example.test', displayName: 'Empty Fixture User' },
          }),
          {
            status: 200,
            headers: {
              'content-type': 'application/json',
              'set-cookie': 'payload-token=fixture-token; Path=/',
            },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            user: { id: '1', email: 'empty@example.test', displayName: 'Empty Fixture User' },
            memberships: [],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      )

    const response = await POST(
      new Request('http://frontend.invalid/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'empty@example.test', password: 'fixture-only' }),
        headers: { 'content-type': 'application/json' },
      }),
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.memberships).toEqual([])
    expect(cookieSet).toHaveBeenCalledOnce()
  })
})
