import { NextRequest, NextResponse } from 'next/server'
import { authFetch } from '@/lib/auth'
import { getApiUrl } from '@/lib/config'

/**
 * BFF route: List properties for the authenticated tenant.
 * Requires tenant query param for tenant scoping.
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const tenantId = searchParams.get('tenantId')
  const limit = searchParams.get('limit') || '50'
  const page = searchParams.get('page') || '1'

  if (!tenantId) {
    return NextResponse.json({ message: 'tenantId is required' }, { status: 400 })
  }

  const apiUrl = getApiUrl()
  const response = await authFetch(
    `${apiUrl}/api/properties?where[tenant][equals]=${tenantId}&limit=${limit}&page=${page}&depth=2`,
    {
      headers: { 'Content-Type': 'application/json' },
    },
  )

  const data = await response.json()
  return NextResponse.json(data, { status: response.status })
}

/**
 * BFF route: Create a new property for the authenticated tenant.
 */
export async function POST(request: NextRequest) {
  const body = await request.json()
  const apiUrl = getApiUrl()

  const response = await authFetch(`${apiUrl}/api/properties`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  const data = await response.json()
  return NextResponse.json(data, { status: response.status })
}
