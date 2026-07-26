/**
 * Turn C21 scraper dumps into the single static dataset consumed by the
 * frontend price map (apps/frontend/public/data/santa-cruz-market.json).
 *
 *   pnpm tsx scripts/c21/build-map-data.ts
 *   pnpm tsx scripts/c21/build-map-data.ts --in=scripts/c21/out/foo.json
 *
 * With no --in, every *.json in scripts/c21/out (except *.full.json) is merged
 * and deduped by listing id, keeping the most recently fetched version.
 */
import { readFile, readdir, writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(here, '../..')
const outDir = path.join(here, 'out')
const target = path.join(repoRoot, 'apps/frontend/public/data/santa-cruz-market.json')

/** Viewport that covers the city of Santa Cruz de la Sierra. */
const BBOX = {
  northEastLat: -17.71638325836502,
  northEastLng: -63.08221245197123,
  southWestLat: -17.840615505599597,
  southWestLng: -63.286146162535495,
}

/**
 * The source data has a long tail of typos (an 80m² flat at USD 38, another at
 * USD 55M). Anything outside these bands is dropped so the colour scale stays
 * meaningful instead of being flattened by two outliers.
 */
const LIMITS = {
  price: [12_000, 4_000_000],
  m2: [18, 1_200],
  pricePerM2: [250, 8_000],
} as const

type Slim = {
  id: string
  title: string | null
  price: number | null
  currency: string
  lat: number | null
  lon: number | null
  m2Construction: number | null
  bedrooms: number | null
  bathrooms: number | null
  parking: number | null
  municipality: string
  neighborhood: string
  street: string
  propertyType: string
  operation: string
  url: string | null
  listedAt: string
  hidePrice: boolean
}

type Dump = { fetchedAt?: string; listings: Slim[] }

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0
  const pos = (sorted.length - 1) * q
  const lo = Math.floor(pos)
  const hi = Math.ceil(pos)
  if (lo === hi) return sorted[lo]!
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (pos - lo)
}

function round(n: number, decimals = 0): number {
  const f = 10 ** decimals
  return Math.round(n * f) / f
}

/** Six evenly spaced quantile stops — drives both the legend and the ramp. */
function breaks(values: number[]): number[] {
  const sorted = [...values].sort((a, b) => a - b)
  return [0.05, 0.25, 0.5, 0.75, 0.9, 0.98].map((q) => round(quantile(sorted, q)))
}

async function loadDumps(explicit: string | null): Promise<Slim[]> {
  const files = explicit
    ? [path.resolve(repoRoot, explicit)]
    : (await readdir(outDir))
        .filter((f) => f.endsWith('.json') && !f.endsWith('.full.json'))
        .map((f) => path.join(outDir, f))

  if (files.length === 0) throw new Error(`no dumps found in ${outDir}`)

  const byId = new Map<string, { fetchedAt: string; listing: Slim }>()
  for (const file of files) {
    const dump = JSON.parse(await readFile(file, 'utf8')) as Dump
    const fetchedAt = dump.fetchedAt ?? ''
    for (const listing of dump.listings ?? []) {
      const prev = byId.get(listing.id)
      if (!prev || prev.fetchedAt <= fetchedAt) byId.set(listing.id, { fetchedAt, listing })
    }
    console.log(`  read ${path.relative(repoRoot, file)}: ${dump.listings?.length ?? 0} listings`)
  }

  return [...byId.values()].map((v) => v.listing)
}

async function main() {
  const args = process.argv.slice(2)
  const inFlag = args.find((a) => a.startsWith('--in='))
  const raw = await loadDumps(inFlag ? inFlag.slice('--in='.length) : null)

  const dropped = { geo: 0, price: 0, m2: 0, ppm: 0 }
  type Row = {
    id: string
    lat: number
    lon: number
    price: number
    m2: number
    ppm: number
    bedrooms: number
    bathrooms: number
    parking: number
    zone: string
    operation: string
    propertyType: string
    title: string
    street: string
    urlPath: string
  }

  const rows: Row[] = []
  for (const l of raw) {
    const { lat, lon } = l
    if (
      lat == null ||
      lon == null ||
      lat < BBOX.southWestLat ||
      lat > BBOX.northEastLat ||
      lon < BBOX.southWestLng ||
      lon > BBOX.northEastLng
    ) {
      dropped.geo += 1
      continue
    }
    // Every listing scraped so far is USD; skip anything else rather than
    // guessing an exchange rate.
    const price = l.currency === 'USD' && !l.hidePrice ? l.price : null
    if (price == null || price < LIMITS.price[0] || price > LIMITS.price[1]) {
      dropped.price += 1
      continue
    }
    const m2 = l.m2Construction
    if (m2 == null || m2 < LIMITS.m2[0] || m2 > LIMITS.m2[1]) {
      dropped.m2 += 1
      continue
    }
    const ppm = price / m2
    if (ppm < LIMITS.pricePerM2[0] || ppm > LIMITS.pricePerM2[1]) {
      dropped.ppm += 1
      continue
    }

    rows.push({
      id: l.id,
      lat: round(lat, 6),
      lon: round(lon, 6),
      price: round(price),
      m2: round(m2, 1),
      ppm: round(ppm),
      bedrooms: l.bedrooms ?? 0,
      bathrooms: l.bathrooms ?? 0,
      parking: l.parking ?? 0,
      zone: l.municipality || 'Sin zona',
      operation: l.operation || 'venta',
      propertyType: l.propertyType || 'departamento',
      title: (l.title ?? '').trim(),
      street: (l.street ?? '').trim(),
      urlPath: l.url ? l.url.replace(/^https?:\/\/c21\.com\.bo/, '') : '',
    })
  }

  rows.sort((a, b) => a.ppm - b.ppm)

  const zones = [...new Set(rows.map((r) => r.zone))].sort()
  const operations = [...new Set(rows.map((r) => r.operation))].sort()
  const propertyTypes = [...new Set(rows.map((r) => r.propertyType))].sort()

  const zoneStats = zones
    .map((zone) => {
      const inZone = rows.filter((r) => r.zone === zone)
      const ppms = inZone.map((r) => r.ppm).sort((a, b) => a - b)
      const prices = inZone.map((r) => r.price).sort((a, b) => a - b)
      return {
        zone,
        count: inZone.length,
        medianPricePerM2: round(quantile(ppms, 0.5)),
        medianPrice: round(quantile(prices, 0.5)),
        p25PricePerM2: round(quantile(ppms, 0.25)),
        p75PricePerM2: round(quantile(ppms, 0.75)),
      }
    })
    .sort((a, b) => b.medianPricePerM2 - a.medianPricePerM2)

  const allPpm = rows.map((r) => r.ppm)
  const allPrice = rows.map((r) => r.price)

  // Row arrays instead of objects: ~40% smaller payload, decoded once on load.
  const fields = [
    'id',
    'lat',
    'lon',
    'price',
    'm2',
    'ppm',
    'bedrooms',
    'bathrooms',
    'parking',
    'zoneIndex',
    'title',
    'street',
    'urlPath',
  ] as const

  const payload = {
    source: 'c21.com.bo',
    generatedAt: new Date().toISOString(),
    city: 'Santa Cruz de la Sierra',
    urlBase: 'https://c21.com.bo',
    bbox: BBOX,
    center: {
      lat: round((BBOX.northEastLat + BBOX.southWestLat) / 2, 6),
      lng: round((BBOX.northEastLng + BBOX.southWestLng) / 2, 6),
    },
    operations,
    propertyTypes,
    zones,
    stats: {
      count: rows.length,
      price: {
        min: Math.min(...allPrice),
        max: Math.max(...allPrice),
        median: round(
          quantile(
            [...allPrice].sort((a, b) => a - b),
            0.5,
          ),
        ),
        breaks: breaks(allPrice),
      },
      pricePerM2: {
        min: Math.min(...allPpm),
        max: Math.max(...allPpm),
        median: round(
          quantile(
            [...allPpm].sort((a, b) => a - b),
            0.5,
          ),
        ),
        breaks: breaks(allPpm),
      },
      m2: {
        min: Math.min(...rows.map((r) => r.m2)),
        max: Math.max(...rows.map((r) => r.m2)),
      },
      bedroomsMax: Math.max(...rows.map((r) => r.bedrooms)),
    },
    zoneStats,
    fields,
    listings: rows.map((r) => [
      r.id,
      r.lat,
      r.lon,
      r.price,
      r.m2,
      r.ppm,
      r.bedrooms,
      r.bathrooms,
      r.parking,
      zones.indexOf(r.zone),
      r.title,
      r.street,
      r.urlPath,
    ]),
  }

  await mkdir(path.dirname(target), { recursive: true })
  await writeFile(target, JSON.stringify(payload))

  const bytes = Buffer.byteLength(JSON.stringify(payload))
  console.log(
    JSON.stringify(
      {
        input: raw.length,
        kept: rows.length,
        dropped,
        zones: zones.length,
        medianPricePerM2: payload.stats.pricePerM2.median,
        sizeKB: round(bytes / 1024, 1),
        wrote: path.relative(repoRoot, target),
      },
      null,
      2,
    ),
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
