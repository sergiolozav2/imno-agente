import { NextRequest, NextResponse } from 'next/server'
import { authFetch } from '@/lib/auth'
import { getApiUrl } from '@/lib/config'

/**
 * BFF route: Get a single buyer client by ID.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const apiUrl = getApiUrl()

  const response = await authFetch(`${apiUrl}/api/buyer-clients/${id}?depth=1`, {
    headers: { 'Content-Type': 'application/json' },
  })

  const data = await response.json()
  return NextResponse.json(data, { status: response.status })
}

/**
 * BFF route: Update a buyer client.
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await request.json()
  const apiUrl = getApiUrl()

  const response = await authFetch(`${apiUrl}/api/buyer-clients/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  const data = await response.json()
  return NextResponse.json(data, { status: response.status })
}

/**
 * BFF route: Delete a buyer client.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const apiUrl = getApiUrl()

  const response = await authFetch(`${apiUrl}/api/buyer-clients/${id}`, {
    method: 'DELETE',
  })

  const data = await response.json()
  return NextResponse.json(data, { status: response.status })
}
