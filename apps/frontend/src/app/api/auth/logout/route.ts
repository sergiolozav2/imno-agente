import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { getApiUrl } from '@/lib/config'

export async function POST() {
  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get('payload-token')

  if (sessionCookie) {
    try {
      const apiUrl = getApiUrl()
      // Forward logout to Payload API
      await fetch(`${apiUrl}/api/users/logout`, {
        method: 'POST',
        headers: {
          Cookie: `payload-token=${sessionCookie.value}`,
        },
        credentials: 'include',
      })
    } catch {
      // Ignore errors on logout
    }
  }

  // Clear the session cookie
  cookieStore.delete('payload-token')

  return NextResponse.json({ success: true })
}
