import { describe, it, expect } from 'vitest'
import { resolveTenantContext, authorizeResource, assignOwnership } from './tenant-context'

const tenants = [
  { id: 'tenant-sunshine', slug: 'sunshine-realty' },
  { id: 'tenant-moonlight', slug: 'moonlight-estates' },
]
const memberships = [
  { userId: 'user-sun', tenantId: 'tenant-sunshine', role: 'owner' as const },
  { userId: 'user-moon', tenantId: 'tenant-moonlight', role: 'owner' as const },
]

describe('resolveTenantContext', () => {
  it('resolves the active tenant from membership + slug', () => {
    const result = resolveTenantContext({
      userId: 'user-sun',
      requestedSlug: 'Sunshine Realty',
      tenants,
      memberships,
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.tenantId).toBe('tenant-sunshine')
      expect(result.value.tenantSlug).toBe('sunshine-realty')
    }
  })

  it('denies a user with no membership for the requested tenant (non-disclosing)', () => {
    const result = resolveTenantContext({
      userId: 'user-moon',
      requestedSlug: 'sunshine-realty',
      tenants,
      memberships,
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('RESOURCE_NOT_FOUND')
  })

  it('denies an unknown tenant slug the same way as a foreign one', () => {
    const result = resolveTenantContext({
      userId: 'user-sun',
      requestedSlug: 'does-not-exist',
      tenants,
      memberships,
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('RESOURCE_NOT_FOUND')
  })
})

describe('authorizeResource (cross-tenant denial)', () => {
  const ctx = {
    tenantId: 'tenant-sunshine',
    tenantSlug: 'sunshine-realty',
    principal: { kind: 'user' as const, userId: 'user-sun', role: 'owner' as const },
  }

  it('allows a resource owned by the active tenant', () => {
    expect(authorizeResource(ctx, 'tenant-sunshine').ok).toBe(true)
  })

  it('denies a foreign resource without disclosing existence', () => {
    const result = authorizeResource(ctx, 'tenant-moonlight')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('RESOURCE_NOT_FOUND')
  })

  it('denies a missing resource ownership value', () => {
    expect(authorizeResource(ctx, null).ok).toBe(false)
  })
})

describe('assignOwnership', () => {
  it('overwrites any browser-supplied tenant id with the active tenant', () => {
    const ctx = {
      tenantId: 'tenant-sunshine',
      tenantSlug: 'sunshine-realty',
      principal: { kind: 'user' as const, userId: 'user-sun', role: 'owner' as const },
    }
    const assigned = assignOwnership(ctx, { tenantId: 'tenant-moonlight', name: 'x' })
    expect(assigned.tenantId).toBe('tenant-sunshine')
  })
})
