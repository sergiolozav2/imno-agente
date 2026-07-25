import { NextRequest, NextResponse } from 'next/server'
import { authFetch } from '@/lib/auth'
import { getApiUrl } from '@/lib/config'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const tenantId = searchParams.get('tenantId')
  const limit = searchParams.get('limit') || '50'
  const search = searchParams.get('search')?.trim()

  if (!tenantId) {
    return NextResponse.json({ message: 'tenantId is required' }, { status: 400 })
  }

  const query = new URLSearchParams({
    'where[tenant][equals]': tenantId,
    limit,
    depth: '1',
    sort: '-createdAt',
  })

  // Case-insensitive partial match on the client name.
  if (search) query.set('where[name][like]', search)

  const apiUrl = getApiUrl()
  const response = await authFetch(`${apiUrl}/api/buyer-clients?${query.toString()}`)

  const data = await response.json()
  return NextResponse.json(data, { status: response.status })
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const apiUrl = getApiUrl()

  const response = await authFetch(`${apiUrl}/api/buyer-clients`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  const data = await response.json()
  return NextResponse.json(data, { status: response.status })
}
