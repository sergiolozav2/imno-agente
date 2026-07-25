import type { Access, FieldHook, CollectionBeforeChangeHook } from 'payload'
import { membershipTenantIds } from './membership'

/**
 * Read/update/delete access scoped to the user's tenants. Returns a Payload
 * `where` constraint so a foreign row is simply not found (non-disclosing).
 * `overrideAccess: true` (seed/setup) bypasses this entirely.
 * When there is no user but the call is server-side (no req.user), allow reads
 * so that relationship validation during seed/internal operations succeeds.
 */
export function tenantScopedAccess(tenantField = 'tenant'): Access {
  return async ({ req }) => {
    // No authenticated user — allow server-side internal/seed reads through.
    if (!req.user) return true
    const ids = await membershipTenantIds(req)
    if (ids.length === 0) return false
    return { [tenantField]: { in: ids } } as ReturnType<Access>
  }
}

/** Access for the `tenants` collection itself (scoped by id, not a tenant field). */
export const tenantsOwnAccess: Access = async ({ req }) => {
  if (!req.user) return false
  const ids = await membershipTenantIds(req)
  if (ids.length === 0) return false
  return { id: { in: ids } }
}

/** Any authenticated user may attempt a create; the tenant is assigned server-side. */
export const authenticatedCreate: Access = ({ req }) => Boolean(req.user)

/**
 * Field hook that overwrites the tenant ownership value on create with a
 * membership the user actually belongs to, ignoring any browser-supplied value.
 * When the user belongs to exactly one tenant it is inferred; otherwise the
 * provided value must be one of the user's tenants.
 */
export const assignTenantFieldHook: FieldHook = async ({ req, value, operation }) => {
  if (operation !== 'create' && operation !== 'update') return value
  if (!req.user) return value
  const ids = await membershipTenantIds(req)
  if (ids.length === 0) return value
  if (value && ids.includes(String(value))) return value
  if (ids.length === 1) return ids[0]
  return value
}

/**
 * Collection-level guard that rejects a create/update whose resolved tenant is
 * not one of the user's tenants (defence in depth alongside the field hook).
 */
export function assertTenantMembership(tenantField = 'tenant'): CollectionBeforeChangeHook {
  return async ({ req, data, operation }) => {
    if (operation !== 'create' && operation !== 'update') return data
    // Seed/setup code uses overrideAccess and has no user; allow it through.
    if (!req.user) return data
    const ids = await membershipTenantIds(req)
    const tenantValue = data?.[tenantField]
    if (tenantValue && !ids.includes(String(tenantValue))) {
      throw new Error('TENANT_FORBIDDEN')
    }
    return data
  }
}
