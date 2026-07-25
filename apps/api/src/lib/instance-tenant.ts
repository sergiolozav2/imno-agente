import type { Payload } from 'payload'
import { type Result, type SafeError, ErrorCode, err, ok } from '@imno/contracts'
import type { TenantContext } from '@imno/domain'

/**
 * Resolve the owning tenant from a provider instance name.
 *
 * This is the only place an unauthenticated channel event acquires a tenant
 * identity, and it does so from server state (the persisted `whatsapp-instances`
 * row) — never from the webhook body. Unknown instances return a non-disclosing
 * NOT_FOUND so the endpoint cannot be used to enumerate tenants.
 */

export interface ResolvedInstance {
  context: TenantContext
  /** Payload id of the `whatsapp-instances` row, for the receipt relationship. */
  instanceId: string
  /** Tenant country, used as the fallback context for phone normalization. */
  countryCode: string
}

export async function resolveTenantFromInstance(
  payload: Payload,
  instanceName: string,
): Promise<Result<ResolvedInstance, SafeError>> {
  const found = await payload.find({
    collection: 'whatsapp-instances',
    where: { instanceName: { equals: instanceName } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })

  const instance = found.docs[0]
  if (!instance) return err({ code: ErrorCode.ResourceNotFound })

  const tenantId = String(
    typeof instance.tenant === 'object' && instance.tenant !== null
      ? (instance.tenant as { id: unknown }).id
      : instance.tenant,
  )
  if (!tenantId) return err({ code: ErrorCode.ResourceNotFound })

  const tenant = await payload
    .findByID({ collection: 'tenants', id: tenantId, depth: 0, overrideAccess: true })
    .catch(() => null)
  if (!tenant) return err({ code: ErrorCode.ResourceNotFound })

  const doc = tenant as { slug?: string; countryCode?: string }

  return ok({
    context: {
      tenantId,
      tenantSlug: String(doc.slug ?? ''),
      principal: { kind: 'channel', channelId: instanceName },
    },
    instanceId: String(instance.id),
    countryCode: String(doc.countryCode ?? 'ES'),
  })
}

/** The deterministic instance name a tenant's WhatsApp line is registered under. */
export function deterministicInstanceName(prefix: string, tenantSlug: string): string {
  return `${prefix}-${tenantSlug}`
}

/** Look up the WhatsApp instance name a tenant sends from. */
export async function findInstanceNameForTenant(
  payload: Payload,
  tenantId: string,
): Promise<string | null> {
  const found = await payload.find({
    collection: 'whatsapp-instances',
    where: { tenant: { equals: tenantId } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const name = found.docs[0]?.instanceName
  return typeof name === 'string' && name.length > 0 ? name : null
}
