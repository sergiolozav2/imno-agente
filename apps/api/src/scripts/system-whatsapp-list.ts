/**
 * Lists every Evolution instance, system lines (`SYSTEM_*`) first, next to what
 * the database believes the system line is. Divergence between the two columns
 * is the usual reason the system agent cannot send.
 *
 * Run with: `pnpm wa:list` (or `pnpm wa:list:remote`)
 */
import { fetchInstances, loadEvolutionEnv } from './evolution-admin'
import { runScript, withPayloadClient } from './payload-script'
import { readSystemWhatsapp } from '../lib/system-whatsapp'

runScript('WhatsApp list', async () => {
  const env = loadEvolutionEnv()

  console.log('Evolution API')
  console.log(`  base URL   ${env.baseUrl}`)
  console.log(`  webhook    ${env.webhookUrl || '(not set)'}`)

  console.log('\n→ Fetching instances…')
  const instances = await fetchInstances(env)

  if (instances.length === 0) {
    console.log('  no instances exist yet. Create the system line with `pnpm wa:connect`.')
  } else {
    console.log(`  ${instances.length} instance(s)\n`)
    for (const instance of instances) {
      const tag = instance.isSystem ? 'SYSTEM' : 'tenant'
      console.log(`  [${tag}] ${instance.name}`)
      console.log(`    instance id   ${instance.id ?? '(none)'}`)
      console.log(`    api key       ${instance.token ?? '(none returned)'}`)
      console.log(`    connection    ${instance.rawState}`)
      console.log(`    owner jid     ${instance.ownerJid ?? '(not connected)'}`)
      console.log(`    profile name  ${instance.profileName ?? '-'}`)
      console.log('')
    }
  }

  console.log('→ Reading the system-whatsapp global…')
  const stored = await withPayloadClient((payload) => readSystemWhatsapp(payload))

  if (!stored.instanceName) {
    console.log('  nothing stored. The system agent has no line to send from.')
    console.log('  Run `pnpm wa:connect` to provision one.')
    return
  }

  console.log(`  instance name   ${stored.instanceName}`)
  console.log(`  instance id     ${stored.externalInstanceId ?? '(none)'}`)
  console.log(`  api key         ${stored.apiKey ?? '(none stored)'}`)
  console.log(`  connection      ${stored.connectionState}`)
  console.log(`  webhook         ${stored.webhookConfigured ? 'configured' : 'not configured'}`)
  console.log(`  number          ${stored.connectedNumber ?? '(not connected)'}`)
  console.log(`  connected at    ${stored.connectedAt ?? '-'}`)

  const live = instances.find((instance) => instance.name === stored.instanceName)
  if (!live) {
    console.log(
      '\n  ! The stored instance no longer exists in Evolution. Run `pnpm wa:delete` then `pnpm wa:connect`.',
    )
  } else if (live.connectionState !== stored.connectionState) {
    console.log(
      `\n  ! Stored state (${stored.connectionState}) differs from Evolution (${live.rawState}).` +
        ' Re-run `pnpm wa:connect` to refresh it.',
    )
  }
})
