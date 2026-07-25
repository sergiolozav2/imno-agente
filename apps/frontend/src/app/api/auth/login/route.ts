import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { getApiUrl } from '@/lib/config'

const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { email, password } = body

    if (!email || !password) {
      return NextResponse.json({ message: 'Email and password are required' }, { status: 400 })
    }

    const apiUrl = getApiUrl()

    const response = await fetch(`${apiUrl}/api/users/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
      credentials: 'include',
    })

    const data = await response.json()

    if (!response.ok) {
      return NextResponse.json(
        { message: data.errors?.[0]?.message || 'Login failed' },
        { status: response.status },
      )
    }

    // Memberships are resolved before the session cookie is issued. A failed
    // lookup must not be projected as a valid zero-membership session, which
    // the client would otherwise render as "this account has no agencies".
    const meResponse = await fetch(`${apiUrl}/api/auth/me`, {
      headers: { Cookie: `payload-token=${data.token}` },
      credentials: 'include',
    })

    if (!meResponse.ok) {
      return NextResponse.json(
        { message: 'No se pudieron resolver las membresías de la cuenta' },
        { status: 503 },
      )
    }

    const meData = await meResponse.json()

    if (!Array.isArray(meData.memberships)) {
      return NextResponse.json(
        { message: 'No se pudieron resolver las membresías de la cuenta' },
        { status: 503 },
      )
    }

    const setCookie = response.headers.get('set-cookie')
    const tokenMatch = setCookie?.match(/payload-token=([^;]+)/)

    if (tokenMatch) {
      const cookieStore = await cookies()
      cookieStore.set('payload-token', tokenMatch[1], {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: SESSION_MAX_AGE_SECONDS,
      })
    }

    return NextResponse.json({
      user: {
        id: data.user?.id || meData.user?.id,
        email: data.user?.email || meData.user?.email,
        displayName: data.user?.displayName || meData.user?.displayName,
      },
      memberships: meData.memberships,
    })
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}
