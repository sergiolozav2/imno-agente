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
 *
 * Payload's REST upload endpoint only reads document fields from a `_payload`
 * JSON part; plain multipart fields are ignored, so `tenant` and `kind` would
 * come back as validation errors. Rebuild the body accordingly.
 */
export async function POST(request: NextRequest) {
  const incoming = await request.formData()
  const file = incoming.get('file')

  if (!(file instanceof File)) {
    return NextResponse.json({ message: 'file is required' }, { status: 400 })
  }

  const doc: Record<string, unknown> = {}
  for (const [key, value] of incoming.entries()) {
    if (key === 'file' || value instanceof File) continue
    doc[key] = /^\d+$/.test(value) ? Number(value) : value
  }

  const outgoing = new FormData()
  outgoing.append('file', file, file.name)
  outgoing.append('_payload', JSON.stringify(doc))

  const apiUrl = getApiUrl()
  const response = await authFetch(`${apiUrl}/api/media-assets`, {
    method: 'POST',
    body: outgoing,
  })

  const data = await response.json()
  return NextResponse.json(data, { status: response.status })
}
