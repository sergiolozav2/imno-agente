/**
 * Session + membership resolution for the frontend BFF.
 *
 * The frontend needs the tenants a user belongs to (with slug and name) in one
 * round trip so it can route to /app/{tenantSlug} straight after login. Payload's
 * own /api/users/me only returns the user, so this composes the two reads.
 *
 * Declared ahead of Payload's /api/[...slug] catch-all: an explicit segment wins
 * over a catch-all in Next's route matching, the same way /api/health does.
 */
import { headers as nextHeaders } from 'next/headers'
import { getPayloadClient } from '@/lib/payload-client'

export const dynamic = 'force-dynamic'

interface SessionMembership {
  tenantId: string
  tenantSlug: string
  tenantName: string
  role: 'owner' | 'member'
}

export async function GET() {
  const payload = await getPayloadClient()
  const { user } = await payload.auth({ headers: await nextHeaders() })

  if (!user) {
    return Response.json({ user: null, memberships: [] }, { status: 401 })
  }

  // Already scoped to the authenticated user's own rows, so overrideAccess keeps
  // the tenant relationship populated without re-deriving membership access.
  const result = await payload.find({
    collection: 'memberships',
    where: { user: { equals: user.id } },
    depth: 1,
    limit: 200,
    overrideAccess: true,
  })

  const memberships = result.docs.reduce<SessionMembership[]>((acc, doc) => {
    const tenant = doc.tenant
    if (typeof tenant !== 'object' || tenant === null) return acc
    acc.push({
      tenantId: String(tenant.id),
      tenantSlug: tenant.slug,
      tenantName: tenant.name,
      role: doc.role,
    })
    return acc
  }, [])

  return Response.json({
    user: {
      id: String(user.id),
      email: user.email,
      displayName: user.displayName ?? '',
    },
    memberships,
  })
}
