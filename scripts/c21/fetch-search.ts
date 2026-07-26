/**
 * Paginate C21 search JSON until all totalHits are collected.
 *
 *   pnpm tsx scripts/c21/fetch-search.ts
 *   pnpm tsx scripts/c21/fetch-search.ts --tipo=departamento --operacion=venta --save
 *   pnpm tsx scripts/c21/fetch-search.ts --tipo=casa --operacion=venta --delay-ms=500 --save
 */
import { writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { fetchSearchPage, slimListing, summarize, type C21Listing } from './client'

const here = path.dirname(fileURLToPath(import.meta.url))

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

async function main() {
  const args = process.argv.slice(2)
  function flag(name: string, fallback: string) {
    const hit = args.find((a) => a.startsWith(`--${name}=`))
    return hit ? hit.split('=')[1]! : fallback
  }

  const tipo = flag('tipo', 'departamento')
  const operacion = flag('operacion', 'venta') as 'venta' | 'renta'
  const delayMs = Number(flag('delay-ms', '400'))
  const save = args.includes('--save')
  const full = args.includes('--full')

  const byId = new Map<string, C21Listing>()
  let page = 1
  let totalHits = Infinity
  let pagesFetched = 0

  console.log(
    JSON.stringify({ tipo, operacion, delayMs, note: 'sequential pagination, no cookies' }, null, 2),
  )

  while (byId.size < totalHits) {
    const data = await fetchSearchPage({ tipo, operacion, page })
    pagesFetched += 1
    totalHits = Number(data.totalHits)
    const batch = data.results ?? []

    for (const r of batch) byId.set(String(r.id), r)

    console.log(
      `  page ${page}: +${batch.length} (unique ${byId.size}/${totalHits}, pages=${pagesFetched})`,
    )

    if (batch.length === 0) {
      console.warn('empty page — stopping')
      break
    }

    // safety: if page returns duplicates only and we're stuck
    if (byId.size >= totalHits) break
    if (page > Math.ceil(totalHits / 50) + 5) {
      console.warn('page safety stop')
      break
    }

    page += 1
    await sleep(delayMs)
  }

  const raw = [...byId.values()]
  const slim = raw.map(slimListing)
  const summary = {
    ...summarize(slim),
    totalHitsReported: totalHits,
    pagesFetched,
    matchedTotalHits: byId.size === totalHits,
  }

  console.log(JSON.stringify(summary, null, 2))

  if (save) {
    const outDir = path.join(here, 'out')
    await mkdir(outDir, { recursive: true })
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    const base = `${tipo}-${operacion}-${stamp}`
    const slimFile = path.join(outDir, `${base}.json`)
    await writeFile(
      slimFile,
      JSON.stringify(
        {
          source: 'c21.com.bo',
          tipo,
          operacion,
          totalHitsReported: totalHits,
          pagesFetched,
          fetchedAt: new Date().toISOString(),
          listings: slim,
        },
        null,
        2,
      ),
    )
    console.log(`wrote ${slimFile}`)

    if (full) {
      const fullFile = path.join(outDir, `${base}.full.json`)
      await writeFile(
        fullFile,
        JSON.stringify({ tipo, operacion, totalHitsReported: totalHits, results: raw }, null, 2),
      )
      console.log(`wrote ${fullFile}`)
    }
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
