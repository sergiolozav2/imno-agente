/**
 * Client-side model for the static market dataset served from
 * /data/santa-cruz-market.json (built by scripts/c21/build-map-data.ts).
 */

export type MarketRow = [
  id: string,
  lat: number,
  lon: number,
  price: number,
  m2: number,
  ppm: number,
  bedrooms: number,
  bathrooms: number,
  parking: number,
  zoneIndex: number,
  title: string,
  street: string,
  urlPath: string,
]

export interface MetricStats {
  min: number
  max: number
  median: number
  breaks: number[]
}

export interface ZoneStat {
  zone: string
  count: number
  medianPricePerM2: number
  medianPrice: number
  p25PricePerM2: number
  p75PricePerM2: number
}

export interface MarketDataset {
  source: string
  generatedAt: string
  city: string
  urlBase: string
  bbox: {
    northEastLat: number
    northEastLng: number
    southWestLat: number
    southWestLng: number
  }
  center: { lat: number; lng: number }
  zones: string[]
  stats: {
    count: number
    price: MetricStats
    pricePerM2: MetricStats
    m2: { min: number; max: number }
    bedroomsMax: number
  }
  zoneStats: ZoneStat[]
  listings: MarketRow[]
}

export interface Listing {
  id: string
  lat: number
  lon: number
  price: number
  m2: number
  pricePerM2: number
  bedrooms: number
  bathrooms: number
  parking: number
  zone: string
  title: string
  street: string
  url: string
}

export type Metric = 'pricePerM2' | 'price'

export const METRIC_LABEL: Record<Metric, string> = {
  pricePerM2: 'Precio por m²',
  price: 'Precio total',
}

/** Low → high colour ramp shared by the points, the legend and the heatmap. */
export const RAMP = ['#2563eb', '#22d3ee', '#facc15', '#fb923c', '#ef4444'] as const

export function decodeListings(data: MarketDataset): Listing[] {
  return data.listings.map((row) => ({
    id: row[0],
    lat: row[1],
    lon: row[2],
    price: row[3],
    m2: row[4],
    pricePerM2: row[5],
    bedrooms: row[6],
    bathrooms: row[7],
    parking: row[8],
    zone: data.zones[row[9]] ?? 'Sin zona',
    title: row[10],
    street: row[11],
    url: row[12] ? `${data.urlBase}${row[12]}` : '',
  }))
}

export function metricValue(listing: Listing, metric: Metric): number {
  return metric === 'price' ? listing.price : listing.pricePerM2
}

export function metricStats(data: MarketDataset, metric: Metric): MetricStats {
  return metric === 'price' ? data.stats.price : data.stats.pricePerM2
}

export function quantile(values: number[], q: number): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const pos = (sorted.length - 1) * q
  const lo = Math.floor(pos)
  const hi = Math.ceil(pos)
  if (lo === hi) return sorted[lo]!
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (pos - lo)
}

export function median(values: number[]): number {
  return quantile(values, 0.5)
}

const BREAK_QUANTILES = [0.05, 0.25, 0.5, 0.75, 0.9, 0.98]

/**
 * Colour-scale stops for the current selection. Recomputed from the filtered
 * set so the ramp keeps its full contrast, but only once there are enough
 * listings for the quantiles to mean anything.
 */
export function computeBreaks(values: number[], fallback: number[]): number[] {
  if (values.length < 20) return fallback
  const sorted = [...values].sort((a, b) => a - b)
  const stops = BREAK_QUANTILES.map((q) => Math.round(quantile(sorted, q)))
  // Strictly increasing stops keep the interpolation well defined.
  for (let i = 1; i < stops.length; i += 1) {
    if (stops[i]! <= stops[i - 1]!) stops[i] = stops[i - 1]! + 1
  }
  return stops
}

const usd = new Intl.NumberFormat('es-BO', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
})

export function formatUsd(value: number): string {
  return usd.format(value)
}

/** 1.2M / 340K / 890 — keeps legend chips and axis labels narrow. */
export function formatCompactUsd(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1)}M`
  if (value >= 1_000) return `$${Math.round(value / 1_000)}K`
  return `$${Math.round(value)}`
}

export function formatNumber(value: number, decimals = 0): string {
  return new Intl.NumberFormat('es-BO', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value)
}
