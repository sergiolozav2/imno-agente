/**
 * Local stack setup: initialises the Wrangler platform proxy (D1 + R2), then
 * runs Payload migrations so the local SQLite database is ready to use.
 *
 * Run with: `pnpm db:setup`  (cd apps/api && tsx src/scripts/setup.ts)
 */
import { runScript, withLocalPayload } from './local-payload'

runScript('Setup', async () => {
  console.log('→ Initialising local Cloudflare bindings via Wrangler proxy…')
  await withLocalPayload(async (payload) => {
    console.log('  ✓ D1 and R2 bindings ready')
    console.log('→ Running Payload migrations…')
    // migrate() rather than migrateFresh(): the latter calls dropDatabase, which
    // relies on adapter.client.execute() — an API the D1 binding does not expose.
    await payload.db.migrate()
    console.log('  ✓ Database schema created')
  })
  console.log('\nSetup complete.')
})
