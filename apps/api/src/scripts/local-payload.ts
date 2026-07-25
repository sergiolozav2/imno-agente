/**
 * Shared entrypoint for CLI scripts that need the local database.
 *
 * Payload talks to D1/R2 through bindings that only exist inside a Worker, so
 * outside `next dev` we stand up Wrangler's platform proxy first and dispose of
 * it afterwards — without dispose() the miniflare child process keeps the
 * process alive.
 */
import type { Payload } from 'payload'
import { setBindings } from '../cloudflare'
import { getPayloadClient } from '../lib/payload-client'

export async function withLocalPayload<T>(run: (payload: Payload) => Promise<T>): Promise<T> {
  const { getPlatformProxy } = await import('wrangler')
  // configPath is relative to CWD; scripts are run from apps/api.
  const proxy = await getPlatformProxy({ configPath: 'wrangler.jsonc' })
  setBindings(proxy.env as unknown as { D1: D1Database; R2: R2Bucket })

  try {
    return await run(await getPayloadClient())
  } finally {
    await proxy.dispose()
  }
}

/** Run a script body, reporting failures as a non-zero exit rather than a stack trace. */
export function runScript(name: string, body: () => Promise<void>): void {
  body()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(`\n${name} failed:`, err instanceof Error ? err.message : err)
      process.exit(1)
    })
}
