import { NextRequest, NextResponse } from 'next/server'
import { getApiUrl, getInternalSecret } from '@/lib/config'

/**
 * BFF route: Render a property video.
 * Calls the API's video rendering endpoint.
 */
export async function POST(request: NextRequest) {
  const body = await request.json()
  const { tenantId, propertyId } = body

  if (!tenantId || !propertyId) {
    return NextResponse.json({ message: 'tenantId and propertyId are required' }, { status: 400 })
  }

  try {
    const apiUrl = getApiUrl()
    const secret = getInternalSecret()

    // Call the API's video rendering endpoint
    const response = await fetch(`${apiUrl}/api/content/render-video`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Secret': secret,
      },
      body: JSON.stringify({ tenantId, propertyId }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return NextResponse.json(
        { message: errorData.message || 'Failed to render video' },
        { status: response.status },
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Render video error:', error)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}
