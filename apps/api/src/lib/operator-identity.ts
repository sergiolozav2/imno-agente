import type { Payload, Where } from 'payload'

/**
 * Resolve who is writing to the platform's own WhatsApp line.
 *
 * A tenant line identifies its owner structurally: the instance name is
 * registered to exactly one agency. The system line cannot do that — it belongs
 * to the platform, and everyone writes to the same number — so identity has to
 * come from the sender instead. Both lookups read server state only; nothing
 * here trusts a field from the webhook body.
 *
 * Two lookups, in order of confidence:
 *
 *  1. The number an operator registered on their user account. Deliberate, and
 *     works from a personal phone.
 *  2. The number of the agency's own WhatsApp line. Free — we learn it from the
 *     first event Evolution delivers for that instance — but it only covers
 *     agencies that have connected WhatsApp, and it names the agency rather
 *     than a person, so the acting user is that agency's owner.
 */

export interface ResolvedOperator {
  tenantId: string
  tenantSlug: string
  /** The account the agent acts as, and whose chat memory the thread belongs to. */
  userId: string
  countryCode: string
  via: 'user-phone' | 'tenant-line'
}

/** Match both spellings we might have stored: E.164 and the bare digits. */
function phoneSpellings(e164: string): string[] {
  const digits = e164.replace(/^\+/, '')
  return digits === e164 ? [e164] : [e164, digits]
}

export async function resolveOperatorFromPhone(
  payload: Payload,
  e164: string,
): Promise<ResolvedOperator | null> {
  const spellings = phoneSpellings(e164)

  const byUser = await payload.find({
    collection: 'users',
    where: { or: spellings.map((value) => ({ whatsappPhone: { equals: value } })) },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const user = byUser.docs[0]
  if (user) {
    const membership = await primaryMembership(payload, { user: { equals: user.id } })
    if (membership) {
      const tenant = await tenantSummary(payload, membership.tenantId)
      if (tenant) {
        return { ...tenant, userId: String(user.id), via: 'user-phone' }
      }
    }
  }

  const byInstance = await payload.find({
    collection: 'whatsapp-instances',
    where: { or: spellings.map((value) => ({ connectedNumber: { equals: value } })) },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const instance = byInstance.docs[0]
  if (instance) {
    const tenantId = relationId(instance.tenant)
    if (tenantId) {
      const membership = await primaryMembership(payload, { tenant: { equals: tenantId } })
      const tenant = membership ? await tenantSummary(payload, tenantId) : null
      if (membership && tenant) {
        return { ...tenant, userId: membership.userId, via: 'tenant-line' }
      }
    }
  }

  return null
}

/** The membership that speaks for the pair, preferring an owner over a member. */
async function primaryMembership(
  payload: Payload,
  where: Where,
): Promise<{ userId: string; tenantId: string } | null> {
  const found = await payload.find({
    collection: 'memberships',
    where,
    limit: 10,
    depth: 0,
    overrideAccess: true,
  })
  const docs = found.docs as { user?: unknown; tenant?: unknown; role?: unknown }[]
  const chosen = docs.find((doc) => doc.role === 'owner') ?? docs[0]
  if (!chosen) return null

  const userId = relationId(chosen.user)
  const tenantId = relationId(chosen.tenant)
  return userId && tenantId ? { userId, tenantId } : null
}

async function tenantSummary(
  payload: Payload,
  tenantId: string,
): Promise<{ tenantId: string; tenantSlug: string; countryCode: string } | null> {
  const tenant = (await payload
    .findByID({ collection: 'tenants', id: tenantId, depth: 0, overrideAccess: true })
    .catch(() => null)) as { slug?: unknown; countryCode?: unknown } | null
  if (!tenant) return null

  return {
    tenantId,
    tenantSlug: String(tenant.slug ?? ''),
    countryCode: String(tenant.countryCode ?? 'ES'),
  }
}

function relationId(value: unknown): string {
  if (value && typeof value === 'object') {
    return String((value as { id?: unknown }).id ?? '')
  }
  return value === null || value === undefined ? '' : String(value)
}
