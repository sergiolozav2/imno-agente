/**
 * Registers the D1 + R2 bindings, then runs Payload migrations so the database
 * is ready to use.
 *
 * Run with: `pnpm db:setup` for the local Wrangler database, or
 * `pnpm db:setup:remote` to migrate the deployed D1 database.
 */
import { runScript, withPayloadClient } from './payload-script'

runScript('Setup', async () => {
  console.log('→ Initialising Cloudflare bindings…')
  await withPayloadClient(async (payload) => {
    console.log('  ✓ D1 and R2 bindings ready')
    console.log('→ Running Payload migrations…')
    // migrate() rather than migrateFresh(): the latter calls dropDatabase, which
    // relies on adapter.client.execute() — an API the D1 binding does not expose.
    await payload.db.migrate()
    console.log('  ✓ Database schema created')
  })
  console.log('\nSetup complete.')
})
