import { setBindings } from './cloudflare'

/**
 * Next.js startup hook for local development. `setup` and `seed` each create a
 * platform proxy only for their own short-lived Node process, so the persistent
 * `next dev` process must create and register its own D1/R2 bindings.
 *
 * Nx starts this app with `apps/api` as its working directory; explicitly using
 * the colocated Wrangler config ensures the same persistent local D1/R2 state
 * is opened every time. An Edge runtime cannot load Wrangler's Node APIs.
 */
export async function register(): Promise<void> {
  if (process.env.NODE_ENV !== 'development' || process.env.NEXT_RUNTIME === 'edge') return

  const holder = globalThis as unknown as { __IMNO_CF__?: unknown }
  if (holder.__IMNO_CF__) return

  // Next's instrumentation bundle resolves dynamic imports through CommonJS,
  // which causes Wrangler to expose a TypeScript-only dependency. Constructing
  // the import at runtime keeps it on Node's native ESM loader instead.
  const importAtRuntime = new Function('specifier', 'return import(specifier)') as (
    specifier: string,
  ) => Promise<{ getPlatformProxy: (options: { configPath: string }) => Promise<{ env: unknown }> }>
  const { getPlatformProxy } = await importAtRuntime('wrangler')
  const proxy = await getPlatformProxy({ configPath: 'wrangler.jsonc' })
  setBindings(proxy.env as unknown as { D1: D1Database; R2: R2Bucket })
}
