import type { PayloadRequest } from 'payload'

/**
 * Resolve the tenant ids the authenticated user belongs to (owner or member).
 * This is the single source used by every collection's access rule so admin,
 * REST, and local-API reads are all membership-filtered.
 */
export async function membershipTenantIds(req: PayloadRequest): Promise<string[]> {
  const user = req.user
  if (!user) return []
  const result = await req.payload.find({
    collection: 'memberships',
    where: { user: { equals: user.id } },
    depth: 0,
    limit: 200,
    overrideAccess: true,
  })
  return result.docs.map((doc) => {
    const tenant = (doc as unknown as { tenant: unknown }).tenant
    return typeof tenant === 'object' && tenant !== null
      ? String((tenant as { id: string | number }).id)
      : String(tenant)
  })
}

/**
 * Resolve the numeric tenant ids the authenticated user OWNS (role = owner).
 * Kept numeric for direct use in Payload `in` predicates. Used by membership
 * read access so a tenant owner can see the memberships they manage.
 */
export async function ownedTenantIds(req: PayloadRequest): Promise<number[]> {
  const user = req.user
  if (!user) return []
  const result = await req.payload.find({
    collection: 'memberships',
    where: { and: [{ user: { equals: user.id } }, { role: { equals: 'owner' } }] },
    depth: 0,
    limit: 200,
    overrideAccess: true,
    req,
  })
  return result.docs.map((doc) => {
    const tenant = (doc as unknown as { tenant: unknown }).tenant
    return typeof tenant === 'object' && tenant !== null
      ? Number((tenant as { id: string | number }).id)
      : Number(tenant)
  })
}
