import { NextRequest, NextResponse } from 'next/server'
import { authFetch } from '@/lib/auth'

/** BFF route: list the operator's chat sessions, or replay one by threadId. */
export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.toString()

  const response = await authFetch(`/api/agent/sessions${query ? `?${query}` : ''}`)

  const data = await response.json().catch(() => ({ message: 'Unexpected response' }))
  return NextResponse.json(data, { status: response.status })
}
