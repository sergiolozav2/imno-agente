/**
 * Scratch harness: prints the media URLs one property projects through the
 * internal data bridge, which is what the reel pipeline tries to download.
 *
 *   pnpm bridge:probe <tenantId> <propertyId>
 */
import { callDataOperation } from '../mastra/data-client'

const [tenantId, propertyId] = process.argv.slice(2)
if (!tenantId || !propertyId) {
  console.error('usage: bridge-probe <tenantId> <propertyId>')
  process.exit(1)
}

const result = await callDataOperation<{
  property: { reference: string; mainImageUrl: string | null; imageUrls: string[] }
}>(tenantId, 'properties.get', { propertyId })

if (!result.ok) {
  console.error(result.error)
  process.exit(1)
}

const { reference, mainImageUrl, imageUrls } = result.data.property
console.log({ reference, mainImageUrl, imageUrls })

for (const url of [mainImageUrl, ...imageUrls].filter((value): value is string => Boolean(value))) {
  try {
    const response = await fetch(url)
    console.log(`${response.status} ${response.headers.get('content-type')} ${url}`)
  } catch (error) {
    console.log(`UNFETCHABLE ${url} — ${(error as Error).message}`)
  }
}
