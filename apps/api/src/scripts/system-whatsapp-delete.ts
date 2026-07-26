/**
 * Tears down a system WhatsApp line: logs the phone out, deletes the Evolution
 * instance and blanks the `system-whatsapp` global.
 *
 * With no argument it targets the stored line, falling back to the first
 * `SYSTEM_*` instance Evolution knows about. Tenant instances are never
 * touched — pass one and the script refuses.
 *
 * Run with: `pnpm wa:delete [instanceName]` (or `pnpm wa:delete:remote`)
 */
import {
  SYSTEM_PREFIX,
  deleteInstance,
  fetchInstances,
  loadEvolutionEnv,
  logoutInstance,
} from './evolution-admin'
import { runScript, withPayloadClient } from './payload-script'
import { clearSystemWhatsapp, readSystemWhatsapp } from '../lib/system-whatsapp'

runScript('WhatsApp delete', async () => {
  const env = loadEvolutionEnv()
  const requested = process.argv.slice(2).find((arg) => !arg.startsWith('-'))

  if (requested && !requested.startsWith(SYSTEM_PREFIX)) {
    throw new Error(
      `"${requested}" is not a system line. This script only removes ${SYSTEM_PREFIX}* instances.`,
    )
  }

  await withPayloadClient(async (payload) => {
    const stored = await readSystemWhatsapp(payload)
    const systemInstances = (await fetchInstances(env)).filter((instance) => instance.isSystem)

    const target = requested ?? stored.instanceName ?? systemInstances[0]?.name ?? null
    if (!target) {
      console.log('No system WhatsApp line to delete.')
      return
    }

    console.log(`Deleting ${target}`)
    if (systemInstances.length > 1) {
      console.log(
        `  (other system lines remain: ${systemInstances
          .filter((instance) => instance.name !== target)
          .map((instance) => instance.name)
          .join(', ')})`,
      )
    }

    console.log('→ Logging the phone out…')
    await logoutInstance(env, target)

    console.log('→ Deleting the Evolution instance…')
    const deleted = await deleteInstance(env, target)
    console.log(deleted ? '  ✓ deleted' : '  instance did not exist in Evolution')

    if (stored.instanceName === target || !stored.instanceName) {
      console.log('→ Clearing the system-whatsapp global…')
      await clearSystemWhatsapp(payload)
      console.log('  ✓ cleared')
    } else {
      console.log(`  the global still points at ${stored.instanceName}; left untouched.`)
    }
  })

  console.log('\nDone. Run `pnpm wa:connect` to pair a new line.')
})
