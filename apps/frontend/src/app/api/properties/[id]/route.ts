import { NextRequest, NextResponse } from 'next/server'
import { authFetch } from '@/lib/auth'
import { getApiUrl } from '@/lib/config'

/**
 * BFF route: Get a single property by ID.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const apiUrl = getApiUrl()

  const response = await authFetch(`${apiUrl}/api/properties/${id}?depth=2`, {
    headers: { 'Content-Type': 'application/json' },
  })

  const data = await response.json()
  return NextResponse.json(data, { status: response.status })
}

/**
 * BFF route: Update a property.
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await request.json()
  const apiUrl = getApiUrl()

  const response = await authFetch(`${apiUrl}/api/properties/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  const data = await response.json()
  return NextResponse.json(data, { status: response.status })
}

/**
 * BFF route: Delete a property.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const apiUrl = getApiUrl()

  const response = await authFetch(`${apiUrl}/api/properties/${id}`, {
    method: 'DELETE',
  })

  const data = await response.json()
  return NextResponse.json(data, { status: response.status })
}
