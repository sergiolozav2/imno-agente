/**
 * Wipes every row from the application collections so the local database is back
 * to a post-migration, zero-data state. Only touches the local Wrangler D1/R2
 * emulation in `apps/api/.wrangler`; the schema itself is left in place, so no
 * re-migration is needed afterwards.
 *
 * Run with: `pnpm db:reset` (then `pnpm db:seed` to repopulate)
 */
import type { CollectionSlug, Payload } from 'payload'
import { runScript, withLocalPayload } from './local-payload'

/**
 * Child-before-parent so relationship columns never point at a deleted row.
 * `media-assets` follows `properties` because listings reference their images,
 * and `users` is last because memberships reference it.
 */
const DELETION_ORDER: CollectionSlug[] = [
  'message-processing',
  'webhook-receipts',
  'messages',
  'conversations',
  'whatsapp-instances',
  'properties',
  'media-assets',
  'zonal-prices',
  'buyer-clients',
  'memberships',
  'tenants',
  'users',
]

async function wipe(payload: Payload, collection: CollectionSlug): Promise<void> {
  const { docs, errors } = await payload.delete({
    collection,
    where: { id: { exists: true } },
    overrideAccess: true,
  })

  const label = `${collection.padEnd(20)} ${String(docs.length).padStart(4)} deleted`
  if (errors.length > 0) {
    console.log(`  ! ${label}, ${errors.length} failed`)
    for (const error of errors) {
      console.log(`      id ${error.id}: ${error.message}`)
    }
    return
  }
  console.log(`  ✓ ${label}`)
}

runScript('Reset', async () => {
  await withLocalPayload(async (payload) => {
    console.log('→ Deleting all documents from the local database…')
    for (const collection of DELETION_ORDER) {
      await wipe(payload, collection)
    }
  })
  console.log('\nReset complete — run `pnpm db:seed` to repopulate.')
})
