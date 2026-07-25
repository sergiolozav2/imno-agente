import { describe, it, expect } from 'vitest'
import { lookupZonalPrice, formatZonalPriceDisplay, ZONAL_PRICE_UNAVAILABLE } from './zonal-price'
import type { ZonalPrice } from './entities'

const prices: ZonalPrice[] = [
  {
    id: 'zp-1',
    tenantId: 'tenant-sunshine',
    zone: 'Palm District',
    pricingUnit: 'per_sqm',
    amount: 3200,
    currency: 'EUR',
  },
]

describe('lookupZonalPrice', () => {
  it('returns the exact tenant/zone/unit match (zone normalized)', () => {
    const found = lookupZonalPrice(prices, {
      tenantId: 'tenant-sunshine',
      zone: 'palm district',
      pricingUnit: 'per_sqm',
    })
    expect(found?.amount).toBe(3200)
  })

  it('returns null for a foreign tenant', () => {
    expect(
      lookupZonalPrice(prices, {
        tenantId: 'tenant-moonlight',
        zone: 'Palm District',
        pricingUnit: 'per_sqm',
      }),
    ).toBeNull()
  })

  it('returns null when the pricing unit does not match (no fabrication)', () => {
    expect(
      lookupZonalPrice(prices, {
        tenantId: 'tenant-sunshine',
        zone: 'Palm District',
        pricingUnit: 'total',
      }),
    ).toBeNull()
  })
})

describe('formatZonalPriceDisplay', () => {
  it('shows the exact unavailable label when there is no match', () => {
    expect(formatZonalPriceDisplay(null)).toBe(ZONAL_PRICE_UNAVAILABLE)
  })
  it('formats a stored value', () => {
    expect(formatZonalPriceDisplay(prices[0]!)).toContain('EUR')
  })
})
