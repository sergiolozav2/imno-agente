import { NextRequest, NextResponse } from 'next/server'
import { authFetch } from '@/lib/auth'
import { getApiUrl } from '@/lib/config'
import { createInstance } from '@/lib/evolution'

/**
 * BFF route: Ensure WhatsApp instance exists for tenant.
 */
export async function POST(request: NextRequest) {
  const body = await request.json()
  const { tenantId, tenantSlug } = body

  if (!tenantId || !tenantSlug) {
    return NextResponse.json({ message: 'tenantId and tenantSlug are required' }, { status: 400 })
  }

  const apiUrl = getApiUrl()
  const prefix = process.env.EVOLUTION_INSTANCE_PREFIX || 'imno-agent'
  const instanceName = `${prefix}-${tenantSlug}`

  // Provision the instance on Evolution (idempotent) so a QR code exists to
  // scan. This runs even when the Payload row already exists, so a row created
  // before Evolution provisioning still gets reconciled.
  let externalInstanceId: string | null = null
  try {
    const provisioned = await createInstance(instanceName)
    if (!provisioned.ok) {
      return NextResponse.json(
        { message: 'Failed to create WhatsApp instance on Evolution' },
        { status: 502 },
      )
    }
    externalInstanceId = provisioned.externalInstanceId
  } catch {
    return NextResponse.json({ message: 'Could not reach the Evolution API' }, { status: 502 })
  }

  // Return the existing Payload row if one is already persisted.
  const existingResponse = await authFetch(
    `${apiUrl}/api/whatsapp-instances?where[tenant][equals]=${tenantId}&limit=1`,
  )
  const existingData = await existingResponse.json()

  if (existingData.docs?.[0]) {
    return NextResponse.json({ instance: existingData.docs[0] })
  }

  const response = await authFetch(`${apiUrl}/api/whatsapp-instances`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tenant: Number(tenantId),
      instanceName,
      ...(externalInstanceId ? { externalInstanceId } : {}),
      connectionState: 'connecting',
      webhookConfigured: true,
    }),
  })

  const data = await response.json()
  if (!response.ok) {
    return NextResponse.json(data, { status: response.status })
  }
  // Payload create returns `{ doc }`; normalize to `{ instance }` for the client.
  return NextResponse.json({ instance: data.doc ?? data }, { status: response.status })
}
