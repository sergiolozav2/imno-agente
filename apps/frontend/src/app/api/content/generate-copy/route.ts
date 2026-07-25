import { NextRequest, NextResponse } from 'next/server'
import { getInternalSecret } from '@/lib/config'

/**
 * BFF route: Generate social copy for a property.
 * Calls the agent runtime for grounded copy generation.
 */
export async function POST(request: NextRequest) {
  const body = await request.json()
  const { tenantId, propertyId } = body

  if (!tenantId || !propertyId) {
    return NextResponse.json({ message: 'tenantId and propertyId are required' }, { status: 400 })
  }

  try {
    const secret = getInternalSecret()
    const agentUrl = process.env.AGENT_INTERNAL_URL || 'http://localhost:3002'

    const response = await fetch(`${agentUrl}/api/content/generate-copy`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Secret': secret,
      },
      body: JSON.stringify({ tenantId, propertyId }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return NextResponse.json(
        { message: errorData.message || 'Failed to generate copy' },
        { status: response.status },
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Generate copy error:', error)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}
