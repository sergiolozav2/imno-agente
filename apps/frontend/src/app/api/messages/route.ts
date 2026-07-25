import { NextRequest, NextResponse } from 'next/server'
import { authFetch } from '@/lib/auth'
import { getApiUrl } from '@/lib/config'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const tenantId = searchParams.get('tenantId')
  const conversationId = searchParams.get('conversationId')
  const limit = searchParams.get('limit') || '100'

  if (!tenantId || !conversationId) {
    return NextResponse.json(
      { message: 'tenantId and conversationId are required' },
      { status: 400 },
    )
  }

  const apiUrl = getApiUrl()
  const response = await authFetch(
    `${apiUrl}/api/messages?where[tenant][equals]=${tenantId}&where[conversation][equals]=${conversationId}&limit=${limit}&sort=createdAt`,
  )

  const data = await response.json()
  return NextResponse.json(data, { status: response.status })
}
