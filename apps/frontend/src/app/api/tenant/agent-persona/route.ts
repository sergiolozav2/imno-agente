import { NextRequest, NextResponse } from 'next/server'
import { authFetch, getSession } from '@/lib/auth'

/**
 * BFF route: save how this agency's WhatsApp assistant presents itself.
 *
 * The tenant is resolved from the caller's own memberships rather than read from
 * the request, so a browser cannot aim this at another agency. Payload's own
 * access rules scope the write again on the far side.
 */

const TEXT_FIELDS = [
  'agentAssistantName',
  'agentBusinessName',
  'agentLanguage',
  'agentTone',
  'agentGreeting',
  'agentBusinessNotes',
  'agentHandoffLine',
] as const

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ message: 'No autenticado' }, { status: 401 })
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  if (!body) {
    return NextResponse.json({ message: 'Cuerpo inválido' }, { status: 400 })
  }

  const tenantSlug = typeof body.tenantSlug === 'string' ? body.tenantSlug : ''
  const membership = session.memberships.find((m) => m.tenantSlug === tenantSlug)
  if (!membership) {
    return NextResponse.json({ message: 'Sin acceso a esta agencia' }, { status: 403 })
  }

  // A cleared field is stored as null so the agent falls back to its default,
  // rather than instructing it to introduce itself as an empty string.
  const data: Record<string, unknown> = {}
  for (const field of TEXT_FIELDS) {
    const value = body[field]
    if (typeof value !== 'string') continue
    data[field] = value.trim().length > 0 ? value.trim() : null
  }

  const maxCharacters = Number(body.agentMaxReplyCharacters)
  if (Number.isFinite(maxCharacters) && maxCharacters > 0) {
    data.agentMaxReplyCharacters = Math.min(Math.round(maxCharacters), 4000)
  } else if (body.agentMaxReplyCharacters === '' || body.agentMaxReplyCharacters === null) {
    data.agentMaxReplyCharacters = null
  }

  const response = await authFetch(`/api/tenants/${membership.tenantId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })

  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    return NextResponse.json(
      { message: 'No se pudo guardar la configuración' },
      { status: response.status },
    )
  }

  return NextResponse.json({ tenant: payload?.doc ?? payload })
}
