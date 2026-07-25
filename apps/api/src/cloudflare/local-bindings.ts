/**
 * D1/R2 for CLI scripts, through wrangler's platform proxy.
 *
 * With `CLOUDFLARE_ENV=local` this opens the miniflare-backed state under
 * `apps/api/.wrangler`. Any other value selects the matching environment in
 * `wrangler.jsonc` and turns on remote bindings, so the same setup/seed scripts
 * run against the deployed D1 database and R2 bucket from a laptop or CI —
 * wrangler proxies each call rather than emulating it. Remote mode authenticates
 * with `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN`.
 *
 * Nx and the CLI scripts both run with `apps/api` as their working directory;
 * naming the colocated Wrangler config explicitly ensures the same state is
 * opened every time.
 */
import type { AppBindings } from './index'
import { usesLocalBindings } from './index'

interface PlatformProxy {
  env: unknown
  dispose: () => Promise<void>
}

interface PlatformProxyOptions {
  configPath: string
  environment?: string
  remoteBindings?: boolean
}

/**
 * Bundlers rewrite a literal `import('wrangler')` into a CommonJS require, which
 * makes Wrangler expose a TypeScript-only dependency. Building the import out of
 * a string keeps it on Node's native ESM loader and keeps wrangler — a dev
 * dependency — out of every bundle.
 *
 * It has to be constructed inside the call, not at module scope: workerd forbids
 * code generation from strings, and this module is reachable from the Worker
 * bundle even though the Worker never calls it.
 */
function importAtRuntime(
  specifier: string,
): Promise<{ getPlatformProxy: (options: PlatformProxyOptions) => Promise<PlatformProxy> }> {
  const load = new Function('s', 'return import(s)') as (s: string) => Promise<never>
  return load(specifier)
}

export async function createPlatformProxyBindings(): Promise<{
  bindings: AppBindings
  dispose: () => Promise<void>
}> {
  const local = usesLocalBindings()
  const { getPlatformProxy } = await importAtRuntime('wrangler')
  const proxy = await getPlatformProxy({
    configPath: 'wrangler.jsonc',
    environment: local ? 'local' : (process.env.CLOUDFLARE_ENV as string),
    remoteBindings: !local,
  })
  return {
    bindings: proxy.env as AppBindings,
    // Without dispose() the miniflare child process keeps the process alive.
    dispose: () => proxy.dispose(),
  }
}
