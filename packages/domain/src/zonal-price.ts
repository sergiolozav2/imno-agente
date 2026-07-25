import type { PricingUnit } from '@imno/contracts'
import type { ZonalPrice } from './entities'

export const ZONAL_PRICE_UNAVAILABLE = 'Zonal price unavailable' as const

/** Normalize a zone label to the stored key form for exact matching. */
export function normalizeZone(zone: string): string {
  return zone.trim().toLowerCase()
}

export interface ZonalPriceQuery {
  tenantId: string
  zone: string
  pricingUnit: PricingUnit
}

/**
 * Exact tenant-scoped lookup by (tenant, zone, pricing unit). Returns the
 * stored record or null. Never estimates or fabricates a value.
 */
export function lookupZonalPrice(prices: ZonalPrice[], query: ZonalPriceQuery): ZonalPrice | null {
  const zone = normalizeZone(query.zone)
  return (
    prices.find(
      (p) =>
        p.tenantId === query.tenantId &&
        normalizeZone(p.zone) === zone &&
        p.pricingUnit === query.pricingUnit,
    ) ?? null
  )
}

/**
 * Display helper: returns the formatted stored value or exactly
 * `Zonal price unavailable`.
 */
export function formatZonalPriceDisplay(price: ZonalPrice | null): string {
  if (!price) return ZONAL_PRICE_UNAVAILABLE
  return `${price.amount.toLocaleString('es-ES')} ${price.currency}`
}
