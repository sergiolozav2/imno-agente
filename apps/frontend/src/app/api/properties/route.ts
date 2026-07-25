import { NextRequest, NextResponse } from 'next/server'
import { authFetch } from '@/lib/auth'
import { getApiUrl } from '@/lib/config'

/**
 * BFF route: List properties for the authenticated tenant.
 * Requires tenant query param for tenant scoping.
 */
/** Fields a free-text search matches against, OR'd together. */
const SEARCHABLE_FIELDS = ['title', 'reference', 'zone', 'description'] as const

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const tenantId = searchParams.get('tenantId')
  const limit = searchParams.get('limit') || '50'
  const page = searchParams.get('page') || '1'
  const search = searchParams.get('search')?.trim()

  if (!tenantId) {
    return NextResponse.json({ message: 'tenantId is required' }, { status: 400 })
  }

  const query = new URLSearchParams({
    'where[and][0][tenant][equals]': tenantId,
    limit,
    page,
    depth: '2',
    sort: '-createdAt',
  })

  // Case-insensitive partial match across the searchable fields.
  if (search) {
    SEARCHABLE_FIELDS.forEach((field, index) => {
      query.set(`where[and][1][or][${index}][${field}][like]`, search)
    })
  }

  const apiUrl = getApiUrl()
  const response = await authFetch(`${apiUrl}/api/properties?${query.toString()}`, {
    headers: { 'Content-Type': 'application/json' },
  })

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
