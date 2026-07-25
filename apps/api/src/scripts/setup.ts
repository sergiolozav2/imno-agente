/**
 * Local stack setup: initialises the Wrangler platform proxy (D1 + R2), then
 * runs Payload migrations so the local SQLite database is ready to use.
 *
 * Run with: `pnpm db:setup`  (cd apps/api && tsx src/scripts/setup.ts)
 */
import { setBindings } from '../cloudflare'
import { getPayloadClient } from '../lib/payload-client'

async function setup(): Promise<void> {
  console.log('→ Initialising local Cloudflare bindings via Wrangler proxy…')
  const { getPlatformProxy } = await import('wrangler')
  // configPath is relative to CWD; when run from apps/api, wrangler.jsonc is in the same dir.
  const proxy = await getPlatformProxy({ configPath: 'wrangler.jsonc' })
  setBindings(proxy.env as unknown as { D1: D1Database; R2: R2Bucket })
  console.log('  ✓ D1 and R2 bindings ready')

  console.log('→ Initialising Payload and running migrations…')
  const payload = await getPayloadClient()
  // migrate() rather than migrateFresh(): the latter calls dropDatabase, which
  // relies on adapter.client.execute() — an API the D1 binding does not expose.
  await payload.db.migrate()
  console.log('  ✓ Database schema created')

  await proxy.dispose()
  console.log('\nSetup complete.')
}

setup()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Setup failed:', err instanceof Error ? err.message : err)
    process.exit(1)
  })
