/**
 * Cloudflare binding access.
 *
 * Payload always talks to D1 and R2 through the two lazy proxies below. Where
 * those bindings come from depends on who is running:
 *
 *   - Deployed Worker (and `next dev`, via `initOpenNextCloudflareForDev` in
 *     `next.config.ts`) — the real bindings on the request context, resolved
 *     through OpenNext. Nothing to initialize.
 *   - CLI scripts under Node (setup/seed/reset) — no request context exists, so
 *     `initBindings()` opens a wrangler platform proxy and parks the bindings on
 *     `globalThis`. `CLOUDFLARE_ENV` picks the emulated local state or the real
 *     remote database and bucket.
 *
 * The proxies let `payload.config.ts` be evaluated (e.g. at build time) before
 * any binding exists; the real binding is only touched on the first D1/R2
 * operation, which always happens at runtime.
 */
import { getCloudflareContext } from '@opennextjs/cloudflare'
import type { EnvRecord } from '@imno/runtime-config'

export interface AppBindings {
  D1: D1Database
  R2: R2Bucket
}

interface BindingHolder {
  __IMNO_CF__?: AppBindings
}

/** Handle for releasing whatever the bindings hold open (miniflare, in scripts). */
export interface BindingSession {
  dispose: () => Promise<void>
}

const noopSession: BindingSession = { dispose: async () => {} }

export function setBindings(env: AppBindings): void {
  ;(globalThis as unknown as BindingHolder).__IMNO_CF__ = env
}

export function getBindings(): AppBindings {
  const scriptBindings = (globalThis as unknown as BindingHolder).__IMNO_CF__
  if (scriptBindings) return scriptBindings

  const env = getCloudflareContext().env as unknown as Partial<AppBindings>
  if (!env?.D1 || !env?.R2) {
    throw new Error('Cloudflare bindings are not available (D1/R2).')
  }
  return { D1: env.D1, R2: env.R2 }
}

/**
 * Whether this process can reach D1/R2. The health endpoint reports it so a
 * Worker deployed without its bindings fails its health check instead of
 * serving requests that are bound to fail on their first query.
 */
export function bindingsReady(): boolean {
  try {
    getBindings()
    return true
  } catch {
    return false
  }
}

/** True while the local wrangler-emulated D1/R2 state is the target. */
export function usesLocalBindings(env: EnvRecord = process.env): boolean {
  return (env.CLOUDFLARE_ENV ?? 'local') === 'local'
}

/**
 * Registers D1/R2 for a plain Node process (the CLI scripts), once. Requests
 * served by the Worker never need this — they read the bindings off the request
 * context instead.
 */
export async function initBindings(): Promise<BindingSession> {
  if ((globalThis as unknown as BindingHolder).__IMNO_CF__) return noopSession

  // Imported lazily so the Worker bundle never evaluates the wrangler-only path.
  const { createPlatformProxyBindings } = await import('./local-bindings')
  const proxy = await createPlatformProxyBindings()
  setBindings(proxy.bindings)
  return { dispose: proxy.dispose }
}

function createLazyBinding<T extends object>(pick: (b: AppBindings) => T): T {
  return new Proxy({} as T, {
    get(_target, prop) {
      const target = pick(getBindings()) as Record<PropertyKey, unknown>
      const value = target[prop]
      return typeof value === 'function'
        ? (value as (...args: unknown[]) => unknown).bind(target)
        : value
    },
  })
}

/** Lazy D1 binding — resolves the real binding on first use. */
export const lazyD1 = createLazyBinding((b) => b.D1)

/** Lazy R2 binding — resolves the real binding on first use. */
export const lazyR2 = createLazyBinding((b) => b.R2)
