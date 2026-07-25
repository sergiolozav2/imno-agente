import { type Result, type SafeError, ErrorCode, err, ok } from '@imno/contracts'
import type { Membership, Tenant } from './entities'

/**
 * The server-derived tenant identity. Every tenant-owned port method requires
 * one of these. A browser-supplied tenant slug is only a *request*, never
 * authorization evidence.
 */
export interface TenantContext {
  tenantId: string
  tenantSlug: string
  principal:
    | { kind: 'user'; userId: string; role: Membership['role'] }
    | { kind: 'channel'; channelId: string }
}

/** Normalize a requested slug to kebab-case for lookup/matching. */
export function normalizeSlug(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export interface ResolveTenantInput {
  userId: string
  requestedSlug: string
  tenants: Pick<Tenant, 'id' | 'slug'>[]
  memberships: Pick<Membership, 'userId' | 'tenantId' | 'role'>[]
}

/**
 * Resolve the active tenant from the authenticated user, requested slug, and
 * memberships. Returns a non-disclosing failure when the tenant does not exist
 * or the user has no membership for it.
 */
export function resolveTenantContext(input: ResolveTenantInput): Result<TenantContext, SafeError> {
  const slug = normalizeSlug(input.requestedSlug)
  const tenant = input.tenants.find((t) => t.slug === slug)
  if (!tenant) {
    // Do not disclose whether the tenant exists at all.
    return err({ code: ErrorCode.ResourceNotFound })
  }
  const membership = input.memberships.find(
    (m) => m.userId === input.userId && m.tenantId === tenant.id,
  )
  if (!membership) {
    return err({ code: ErrorCode.ResourceNotFound })
  }
  return ok({
    tenantId: tenant.id,
    tenantSlug: tenant.slug,
    principal: { kind: 'user', userId: input.userId, role: membership.role },
  })
}

/**
 * Authorize access to a tenant-owned resource. Returns a non-disclosing
 * NOT_FOUND for foreign resources so cross-tenant probing cannot distinguish
 * "does not exist" from "belongs to another tenant".
 */
export function authorizeResource(
  context: TenantContext,
  resourceTenantId: string | null | undefined,
): Result<void, SafeError> {
  if (!resourceTenantId || resourceTenantId !== context.tenantId) {
    return err({ code: ErrorCode.ResourceNotFound })
  }
  return ok(undefined)
}

/**
 * Server-side ownership assignment: always stamp the active tenant and ignore
 * any browser-supplied tenant field.
 */
export function assignOwnership<T extends { tenantId?: string }>(
  context: TenantContext,
  data: T,
): T & { tenantId: string } {
  return { ...data, tenantId: context.tenantId }
}
