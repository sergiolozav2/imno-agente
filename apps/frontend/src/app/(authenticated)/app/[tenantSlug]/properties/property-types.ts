export const PROPERTY_STATUSES = ['available', 'reserved', 'sold'] as const

export type PropertyStatus = (typeof PROPERTY_STATUSES)[number]

export const PRICING_UNITS = ['total', 'per_sqm', 'per_month'] as const

export type PricingUnit = (typeof PRICING_UNITS)[number]

export interface MediaAsset {
  id: string
  url: string
  filename: string
  kind?: string
}

export interface Property {
  /** Payload IDs are numeric on the D1/SQLite adapter, strings elsewhere. */
  id: string | number
  reference: string
  title: string
  description?: string | null
  price: number
  currency: string
  zone: string
  pricingUnit: PricingUnit
  status: PropertyStatus
  bedrooms?: number | null
  bathrooms?: number | null
  areaSqm?: number | null
  images?: MediaAsset[] | null
  mainImage?: MediaAsset | null
  model3d?: MediaAsset | null
}

export const STATUS_LABELS: Record<PropertyStatus, string> = {
  available: 'Disponible',
  reserved: 'Reservada',
  sold: 'Vendida',
}

export const PRICING_UNIT_LABELS: Record<PricingUnit, string> = {
  total: 'Total',
  per_sqm: 'Por m²',
  per_month: 'Por mes',
}

/** Badge class matching the listing status. */
export function statusBadge(status: PropertyStatus): string {
  return status === 'available'
    ? 'badge-success'
    : status === 'reserved'
      ? 'badge-warning'
      : 'badge-error'
}
