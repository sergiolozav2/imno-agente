/**
 * Provisions the platform's own WhatsApp line and stores it in the
 * `system-whatsapp` global.
 *
 * The whole point of this script is that it works over SSH: the pairing QR is
 * rendered as text in the terminal, so the line can be created on a deployed
 * box before any UI or env var exists for it. It is idempotent — re-running
 * against an already paired instance just refreshes what is stored.
 *
 * Run with: `pnpm wa:connect [instanceName]` (or `pnpm wa:connect:remote`)
 */
import QRCode from 'qrcode'
import {
  SYSTEM_PREFIX,
  createInstance,
  fetchInstances,
  findInstance,
  getConnectionState,
  getPairingCode,
  loadEvolutionEnv,
  type EvolutionEnv,
} from './evolution-admin'
import { runScript, withPayloadClient } from './payload-script'
import { readSystemWhatsapp, writeSystemWhatsapp } from '../lib/system-whatsapp'

/** WhatsApp rotates the pairing code roughly every 20s; poll a little faster. */
const POLL_INTERVAL_MS = 5_000
const QR_REFRESH_MS = 20_000
const PAIRING_TIMEOUT_MS = 3 * 60_000

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * CLI arg wins, then an explicit env pin, then a name derived from the tenant
 * instance prefix. Always forced into the `SYSTEM_` namespace.
 */
function resolveInstanceName(env: EvolutionEnv): string {
  const requested =
    process.argv.slice(2).find((arg) => !arg.startsWith('-')) ??
    process.env.SYSTEM_WHATSAPP_INSTANCE ??
    `${SYSTEM_PREFIX}${env.instancePrefix}`
  const trimmed = requested.trim()
  return trimmed.startsWith(SYSTEM_PREFIX) ? trimmed : `${SYSTEM_PREFIX}${trimmed}`
}

async function printQr(code: string): Promise<void> {
  console.log(await QRCode.toString(code, { type: 'terminal', small: true }))
  console.log('  WhatsApp → Settings → Linked devices → Link a device, then scan the code above.')
}

runScript('WhatsApp connect', async () => {
  const env = loadEvolutionEnv()
  const instanceName = resolveInstanceName(env)

  console.log('Evolution API')
  console.log(`  base URL   ${env.baseUrl}`)
  console.log(`  instance   ${instanceName}`)
  console.log(`  webhook    ${env.webhookUrl || '(not set — inbound messages will not arrive)'}`)

  const existingSystem = (await fetchInstances(env)).filter(
    (instance) => instance.isSystem && instance.name !== instanceName,
  )
  if (existingSystem.length > 0) {
    console.log(
      `\n  ! Other system lines already exist: ${existingSystem.map((i) => i.name).join(', ')}.` +
        ' Only one is used; remove the rest with `pnpm wa:delete <name>`.',
    )
  }

  console.log('\n→ Creating the instance…')
  const created = await createInstance(env, instanceName)
  console.log(created.alreadyExists ? '  already exists, reusing it' : '  ✓ created')

  // A reused instance does not return its token, so read it back from Evolution.
  const live = await findInstance(env, instanceName)
  const token = created.token ?? live?.token ?? null
  const externalInstanceId = created.externalInstanceId ?? live?.id ?? null

  await withPayloadClient(async (payload) => {
    console.log('\n→ Storing the line in the system-whatsapp global…')
    await writeSystemWhatsapp(payload, {
      instanceName,
      externalInstanceId,
      apiKey: token,
      connectionState: 'connecting',
      webhookConfigured: env.webhookUrl.length > 0,
    })
    console.log('  ✓ stored')

    console.log('\n→ Waiting for the phone to pair…')
    const deadline = Date.now() + PAIRING_TIMEOUT_MS
    let lastQrAt = 0
    let lastCode: string | null = null

    while (Date.now() < deadline) {
      const state = await getConnectionState(env, instanceName)
      if (state === 'open') break

      if (Date.now() - lastQrAt >= QR_REFRESH_MS) {
        const pairing = await getPairingCode(env, instanceName)
        if (pairing.code && pairing.code !== lastCode) {
          lastCode = pairing.code
          await printQr(pairing.code)
        } else if (!pairing.code && !lastCode) {
          console.log('  waiting for Evolution to issue a pairing code…')
        }
        lastQrAt = Date.now()
      }

      await sleep(POLL_INTERVAL_MS)
    }

    const finalState = await getConnectionState(env, instanceName)
    if (finalState !== 'open') {
      await writeSystemWhatsapp(payload, { connectionState: finalState })
      throw new Error(
        `the line is still "${finalState}" after ${PAIRING_TIMEOUT_MS / 1000}s. ` +
          'Re-run `pnpm wa:connect` and scan the QR before it expires.',
      )
    }

    const paired = await findInstance(env, instanceName)
    const state = await writeSystemWhatsapp(payload, {
      connectionState: 'open',
      connectedNumber: paired?.ownerJid ?? null,
      connectedAt: new Date().toISOString(),
      ...(paired?.token ? { apiKey: paired.token } : {}),
      ...(paired?.id ? { externalInstanceId: paired.id } : {}),
    })

    console.log('\n  ✓ connected')
    console.log(`    instance   ${state.instanceName}`)
    console.log(`    number     ${state.connectedNumber ?? '(unknown)'}`)
    console.log(`    api key    ${state.apiKey ?? '(none returned)'}`)

    const stored = await readSystemWhatsapp(payload)
    if (!stored.webhookConfigured) {
      console.log(
        '\n  ! EVOLUTION_WEBHOOK_URL was empty, so no webhook is attached: the line can send ' +
          'but will not receive. Set it and re-run this script.',
      )
    }
  })

  console.log('\nSystem WhatsApp is ready.')
})
