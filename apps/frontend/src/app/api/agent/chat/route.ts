import { NextRequest, NextResponse } from 'next/server'
import { authFetch } from '@/lib/auth'

/** BFF route: one turn with the system agent. The API derives identity itself. */
export async function POST(request: NextRequest) {
  const body = await request.json()

  const response = await authFetch('/api/agent/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  const data = await response.json().catch(() => ({ message: 'Unexpected response' }))
  return NextResponse.json(data, { status: response.status })
}
