/**
 * Identity for operator-facing agent routes called from the app UI.
 *
 * The browser may say which workspace it is looking at, but never who it is:
 * the user comes from Payload's session and the tenant is only accepted once a
 * membership row proves it. Everything downstream (agent memory resource, tool
 * tenant scoping) is derived from what this returns, so a forged body cannot
 * reach another tenant's data.
 */
import { headers as nextHeaders } from 'next/headers'
import { getPayloadClient } from './payload-client'

export interface OperatorSession {
  tenantId: string
  tenantSlug: string
  userId: string
}

export type OperatorSessionResult =
  | { ok: true; session: OperatorSession }
  | { ok: false; status: 401 | 403 }

export async function resolveOperatorSession(
  tenantSlug: string | null,
): Promise<OperatorSessionResult> {
  if (!tenantSlug) return { ok: false, status: 403 }

  const payload = await getPayloadClient()
  const { user } = await payload.auth({ headers: await nextHeaders() })
  if (!user) return { ok: false, status: 401 }

  const memberships = await payload.find({
    collection: 'memberships',
    where: { user: { equals: user.id } },
    depth: 1,
    limit: 200,
    overrideAccess: true,
  })

  for (const doc of memberships.docs) {
    const tenant = doc.tenant
    if (typeof tenant !== 'object' || tenant === null) continue
    if (tenant.slug !== tenantSlug) continue
    return {
      ok: true,
      session: { tenantId: String(tenant.id), tenantSlug: tenant.slug, userId: String(user.id) },
    }
  }

  return { ok: false, status: 403 }
}

export interface AgentRuntimeConfig {
  baseUrl: string
  secret: string
}

export function loadAgentRuntimeConfig(): AgentRuntimeConfig | null {
  const baseUrl = process.env.AGENT_INTERNAL_URL
  const secret = process.env.INTERNAL_SERVICE_SECRET
  if (!baseUrl || !secret) return null
  return { baseUrl, secret }
}
