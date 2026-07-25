/**
 * Shared entrypoint for CLI scripts that need a Payload client.
 *
 * Payload talks to D1/R2 through bindings, which only exist inside a Worker, so
 * a script has to stand up wrangler's platform proxy for its own short-lived
 * process first. `CLOUDFLARE_ENV` decides which database is touched: `local`
 * uses the Wrangler emulation under `apps/api/.wrangler`, any other value uses
 * remote bindings against the deployed D1/R2 — which is how the deployed
 * database gets migrated and seeded from a laptop or a CI step.
 */
import type { Payload } from 'payload'
import { initBindings } from '../cloudflare'
import { getPayloadClient } from '../lib/payload-client'

export async function withPayloadClient<T>(run: (payload: Payload) => Promise<T>): Promise<T> {
  const session = await initBindings()
  try {
    return await run(await getPayloadClient())
  } finally {
    await session.dispose()
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
