import type { CollectionAfterChangeHook } from 'payload'

/**
 * After an authenticated user creates a tenant, establish the owner membership
 * tuple so the creator can immediately read/open the tenant (tenantsOwnAccess
 * filters by membership). Runs only for authenticated create operations; trusted
 * seed/setup creates (no req.user) are left untouched and manage their own owner
 * tuple. The write is idempotent: it is skipped when the exact
 * (user, tenant, owner) tuple already exists. Relationship IDs stay numeric.
 */
export const ensureTenantOwner: CollectionAfterChangeHook = async ({ doc, operation, req }) => {
  if (operation !== 'create') return doc

  const user = req.user
  if (!user) return doc // seed/trusted path — do not infer an owner

  const userId = user.id
  const tenantId = doc.id

  const existing = await req.payload.find({
    collection: 'memberships',
    where: {
      and: [
        { user: { equals: userId } },
        { tenant: { equals: tenantId } },
        { role: { equals: 'owner' } },
      ],
    },
    depth: 0,
    limit: 1,
    overrideAccess: true,
    req,
  })

  if (existing.totalDocs === 0) {
    await req.payload.create({
      collection: 'memberships',
      data: { user: userId, tenant: tenantId, role: 'owner' },
      overrideAccess: true,
      req,
    })
  }

  return doc
}
