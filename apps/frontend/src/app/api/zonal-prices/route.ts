import { NextRequest, NextResponse } from 'next/server'
import { authFetch } from '@/lib/auth'
import { getApiUrl } from '@/lib/config'

/**
 * BFF route: Get zonal price for a property's zone.
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const tenantId = searchParams.get('tenantId')
  const zone = searchParams.get('zone')
  const pricingUnit = searchParams.get('pricingUnit') || 'total'

  if (!tenantId || !zone) {
    return NextResponse.json({ message: 'tenantId and zone are required' }, { status: 400 })
  }

  const apiUrl = getApiUrl()
  const response = await authFetch(
    `${apiUrl}/api/zonal-prices?where[tenant][equals]=${tenantId}&where[zone][equals]=${encodeURIComponent(zone)}&where[pricingUnit][equals]=${pricingUnit}&limit=1`,
    {
      headers: { 'Content-Type': 'application/json' },
    },
  )

  const data = await response.json()
  return NextResponse.json(data, { status: response.status })
}
