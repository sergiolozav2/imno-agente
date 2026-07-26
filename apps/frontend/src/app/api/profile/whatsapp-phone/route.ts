import { NextRequest, NextResponse } from 'next/server'
import { authFetch, getSession } from '@/lib/auth'

/**
 * BFF route: register the number this operator writes to the platform's
 * WhatsApp line from. The API normalizes it to E.164 on write, which is what
 * makes an incoming message recognisable as this user.
 */
export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ message: 'No autenticado' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const phone = typeof body?.phone === 'string' ? body.phone.trim() : null
  if (phone === null) {
    return NextResponse.json({ message: 'phone es obligatorio' }, { status: 400 })
  }

  const response = await authFetch(`/api/users/${session.user.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ whatsappPhone: phone }),
  })

  const data = await response.json().catch(() => null)
  if (!response.ok) {
    return NextResponse.json(
      { message: 'No se pudo guardar el número' },
      { status: response.status },
    )
  }

  const saved = (data?.doc ?? data) as { whatsappPhone?: string } | null
  return NextResponse.json({ phone: saved?.whatsappPhone ?? null })
}
