import { NextRequest, NextResponse } from 'next/server'
import { authFetch } from '@/lib/auth'
import { getApiUrl } from '@/lib/config'

/**
 * BFF route: List media assets for the authenticated tenant.
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const tenantId = searchParams.get('tenantId')
  const kind = searchParams.get('kind')

  if (!tenantId) {
    return NextResponse.json({ message: 'tenantId is required' }, { status: 400 })
  }

  let query = `where[tenant][equals]=${tenantId}`
  if (kind) {
    query += `&where[kind][equals]=${kind}`
  }

  const apiUrl = getApiUrl()
  const response = await authFetch(`${apiUrl}/api/media-assets?${query}&limit=100`, {
    headers: { 'Content-Type': 'application/json' },
  })

  const data = await response.json()
  return NextResponse.json(data, { status: response.status })
}

/**
 * BFF route: Upload a media asset.
 */
export async function POST(request: NextRequest) {
  const formData = await request.formData()
  const apiUrl = getApiUrl()

  const response = await authFetch(`${apiUrl}/api/media-assets`, {
    method: 'POST',
    body: formData,
  })

  const data = await response.json()
  return NextResponse.json(data, { status: response.status })
}
