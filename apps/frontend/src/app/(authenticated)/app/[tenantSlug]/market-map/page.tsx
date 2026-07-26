import { redirect } from 'next/navigation'
import { resolveTenant } from '@/lib/auth'
import { MarketMapLoader } from './market-map-loader'

export const metadata = {
  title: 'Mapa de precios · Santa Cruz',
}

export default async function MarketMapPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>
}) {
  const { tenantSlug } = await params
  const tenant = await resolveTenant(tenantSlug)

  if (!tenant) {
    redirect('/login')
  }

  return <MarketMapLoader />
}
