import { NextRequest, NextResponse } from 'next/server'
import { getApiUrl, getInternalSecret } from '@/lib/config'

/**
 * Public chat endpoint - resolves tenant by public key.
 * Does not require authentication - uses tenant public key.
 */
export async function POST(request: NextRequest) {
  const body = await request.json()
  const { publicChatKey, message, sessionId } = body

  if (!publicChatKey || !message) {
    return NextResponse.json({ message: 'publicChatKey and message are required' }, { status: 400 })
  }

  try {
    const apiUrl = getApiUrl()
    const secret = getInternalSecret()

    // Forward to API's public chat endpoint
    const response = await fetch(`${apiUrl}/api/public-chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Secret': secret,
      },
      body: JSON.stringify({
        publicChatKey,
        text: message,
        publicSessionId: sessionId,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return NextResponse.json(
        { message: errorData.message || 'Failed to send message' },
        { status: response.status },
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Public chat error:', error)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}
