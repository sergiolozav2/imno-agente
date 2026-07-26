/**
 * Insert-only: loads Century 21 Santa Cruz listings into the demo-agency tenant
 * (owner@demo.test). Never deletes or resets existing data.
 *
 * Idempotent by reference (`C21-{id}`) so re-runs skip rows already present.
 *
 * Local:  pnpm db:insert-c21
 * Remote: pnpm db:insert-c21:remote
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { Payload } from 'payload'
import sharp from 'sharp'
import { runScript, withPayloadClient } from './payload-script'

const TENANT_SLUG = 'demo-agency'
const COUNT = Number(process.env.C21_INSERT_COUNT || 30)
const JSON_PATH =
  process.env.C21_JSON_PATH ||
  resolve(
    process.cwd(),
    '../../scripts/c21/out/departamento-venta-2026-07-26T09-28-31-200Z.json',
  )

interface C21Listing {
  id: string
  title: string
  price: number | null
  currency: string
  m2Construction: number | null
  bedrooms: number | null
  bathrooms: number | null
  parking: number | null
  municipality: string
  neighborhood: string
  street: string
  state: string
  operation: string
  propertyType: string
  url: string
}

interface C21Dump {
  listings: C21Listing[]
}

interface UploadFile {
  data: Buffer
  mimetype: string
  name: string
  size: number
}

const ZONE_COLORS: Record<string, [number, number, number]> = {
  Norte: [72, 132, 168],
  Equipetrol: [198, 152, 108],
  Oeste: [126, 168, 122],
  Urubo: [104, 154, 186],
  Sur: [172, 124, 148],
  Este: [148, 148, 156],
  Centro: [186, 120, 96],
  'Las Palmas': [120, 160, 140],
  Ciudadelas: [160, 140, 120],
}

function solidImage(name: string, rgb: [number, number, number]): Promise<UploadFile> {
  return sharp({
    create: {
      width: 1200,
      height: 800,
      channels: 3,
      background: { r: rgb[0], g: rgb[1], b: rgb[2] },
    },
  })
    .jpeg({ quality: 70 })
    .toBuffer()
    .then((data) => ({ data, mimetype: 'image/jpeg', name, size: data.length }))
}

function score(listing: C21Listing): number {
  let s = 0
  if (listing.price) s += 2
  if (listing.bedrooms != null) s += 2
  if (listing.bathrooms != null) s += 1
  if (listing.m2Construction) s += 1
  if (listing.street) s += 1
  if (listing.parking != null) s += 0.5
  return s
}

/** Prefer complete rows and spread across municipalities. */
function pickListings(listings: C21Listing[], count: number): C21Listing[] {
  const byZone = new Map<string, C21Listing[]>()
  for (const listing of listings) {
    if (!listing.price || !listing.title || !listing.municipality) continue
    const zone = listing.municipality
    const bucket = byZone.get(zone) ?? []
    bucket.push(listing)
    byZone.set(zone, bucket)
  }

  const zones = [...byZone.keys()].sort(
    (a, b) => (byZone.get(b)?.length ?? 0) - (byZone.get(a)?.length ?? 0),
  )
  const picked: C21Listing[] = []
  const seen = new Set<string>()

  for (const zone of zones) {
    const sorted = [...(byZone.get(zone) ?? [])].sort((a, b) => score(b) - score(a))
    for (const listing of sorted.slice(0, 4)) {
      if (picked.length >= count) break
      if (seen.has(listing.id)) continue
      seen.add(listing.id)
      picked.push(listing)
    }
    if (picked.length >= count) break
  }

  return picked
}

function descriptionFor(listing: C21Listing): string {
  const parts = [
    `${listing.propertyType} en ${listing.operation} en ${listing.municipality}, ${listing.state}.`,
  ]
  if (listing.street) parts.push(`Ubicación: ${listing.street}.`)
  if (listing.neighborhood) parts.push(`Barrio: ${listing.neighborhood}.`)
  const specs: string[] = []
  if (listing.bedrooms != null) specs.push(`${listing.bedrooms} dorm.`)
  if (listing.bathrooms != null) specs.push(`${listing.bathrooms} baños`)
  if (listing.m2Construction != null) specs.push(`${listing.m2Construction} m²`)
  if (listing.parking != null) specs.push(`${listing.parking} parqueo(s)`)
  if (specs.length) parts.push(specs.join(' · ') + '.')
  parts.push(`Fuente: ${listing.url}`)
  return parts.join(' ')
}

async function findExistingReference(
  payload: Payload,
  tenantId: number,
  reference: string,
): Promise<boolean> {
  const existing = await payload.find({
    collection: 'properties',
    where: {
      and: [{ tenant: { equals: tenantId } }, { reference: { equals: reference } }],
    },
    depth: 0,
    limit: 1,
    overrideAccess: true,
  })
  return existing.docs.length > 0
}

runScript('Insert C21 properties', async () => {
  const dump = JSON.parse(readFileSync(JSON_PATH, 'utf8')) as C21Dump
  const listings = pickListings(dump.listings ?? [], COUNT)
  if (listings.length === 0) {
    throw new Error(`No usable listings in ${JSON_PATH}`)
  }

  await withPayloadClient(async (payload) => {
    const tenants = await payload.find({
      collection: 'tenants',
      where: { slug: { equals: TENANT_SLUG } },
      depth: 0,
      limit: 1,
      overrideAccess: true,
    })
    if (tenants.docs.length === 0) {
      throw new Error(`Tenant "${TENANT_SLUG}" not found — seed production first`)
    }
    const tenantId = tenants.docs[0].id as number

    let created = 0
    let skipped = 0

    console.log(`→ Inserting up to ${listings.length} C21 listings into ${TENANT_SLUG}`)

    for (const listing of listings) {
      const reference = `C21-${listing.id}`
      if (await findExistingReference(payload, tenantId, reference)) {
        skipped += 1
        console.log(`  · skip ${reference} (already exists)`)
        continue
      }

      const filename = `${reference.toLowerCase()}-cover.jpg`
      const color = ZONE_COLORS[listing.municipality] ?? [140, 140, 140]
      let mediaId: number | null = null
      try {
        const file = await solidImage(filename, color)
        const media = await payload.create({
          collection: 'media-assets',
          data: { tenant: tenantId, kind: 'image' },
          file,
          overrideAccess: true,
        })
        mediaId = media.id as number
      } catch (err) {
        console.warn(
          `  ! image skipped for ${reference}:`,
          err instanceof Error ? err.message : err,
        )
      }

      await payload.create({
        collection: 'properties',
        data: {
          tenant: tenantId,
          reference,
          title: listing.title,
          description: descriptionFor(listing),
          price: Math.round(listing.price!),
          currency: listing.currency || 'USD',
          zone: listing.municipality,
          pricingUnit: 'total',
          status: 'available',
          bedrooms: listing.bedrooms ?? undefined,
          bathrooms: listing.bathrooms ?? undefined,
          areaSqm: listing.m2Construction ?? undefined,
          ...(mediaId ? { images: [mediaId], mainImage: mediaId } : {}),
        },
        overrideAccess: true,
      })
      created += 1
      console.log(
        `  + ${reference}  ${listing.municipality.padEnd(12)}  $${Math.round(listing.price!).toLocaleString()}  ${listing.title.slice(0, 48)}`,
      )
    }

    console.log(`\nDone — created ${created}, skipped ${skipped} (tenant ${TENANT_SLUG}).`)
  })
})
