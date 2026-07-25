/**
 * Local Cloudflare binding access. `instrumentation.ts` (Next server) and the
 * setup/seed scripts each populate `globalThis.__IMNO_CF__` via wrangler's
 * `getPlatformProxy`. The lazy proxies below let `payload.config.ts` be
 * evaluated (e.g. at build time) before any binding exists; the real binding is
 * only touched on the first D1/R2 operation, which always happens at runtime.
 */

export interface AppBindings {
  D1: D1Database
  R2: R2Bucket
}

interface BindingHolder {
  __IMNO_CF__?: AppBindings
}

export function setBindings(env: AppBindings): void {
  ;(globalThis as unknown as BindingHolder).__IMNO_CF__ = env
}

export function getBindings(): AppBindings {
  const holder = globalThis as unknown as BindingHolder
  if (!holder.__IMNO_CF__?.D1 || !holder.__IMNO_CF__?.R2) {
    throw new Error('Cloudflare bindings are not initialized (D1/R2).')
  }
  return holder.__IMNO_CF__
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
