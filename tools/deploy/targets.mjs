/**
 * Single source of truth for which environment variables each deployable
 * actually reads. `verify.mjs` checks against it and `cf-secrets.mjs` pushes the
 * Worker's subset, so a variable added here is picked up by both.
 *
 * Only variables the code really reads are listed. `loadApiConfig`,
 * `loadVideoConfig` and `loadDeferredMediaConfig` exist in @imno/runtime-config
 * but nothing calls them, so their variables (CLOUDFLARE_D1_BINDING,
 * CLOUDFLARE_R2_BINDING, VIDEO_*, TRANSCRIPTION_PROVIDER, VOICE_PROVIDER,
 * IMAGE_ENHANCEMENT_PROVIDER) are deliberately absent.
 */

/** Worker (apps/api). Set with `pnpm cf:secrets`; D1/R2 arrive as bindings. */
export const WORKER_VARS = [
  'PAYLOAD_SECRET',
  'INTERNAL_SERVICE_SECRET',
  // The Worker's own public origin. Media URLs handed to the agent and to
  // WhatsApp must be absolute, and without this they came out host-relative and
  // unfetchable. The bridge falls back to the request origin, so this only has
  // to be right when the canonical host differs from the one being called.
  'API_URL',
  // Public URL of the Render agent service: the Worker calls it from Cloudflare.
  'AGENT_INTERNAL_URL',
  'EVOLUTION_BASE_URL',
  'EVOLUTION_PUBLIC_URL',
  'EVOLUTION_API_KEY',
  'EVOLUTION_INSTANCE_PREFIX',
  'EVOLUTION_WEBHOOK_SECRET',
  'EVOLUTION_WEBHOOK_URL',
]

/** Render web service (apps/frontend). Set by the Blueprint. */
export const FRONTEND_VARS = [
  'APP_URL',
  'API_URL',
  'AGENT_INTERNAL_URL',
  'INTERNAL_SERVICE_SECRET',
  'EVOLUTION_BASE_URL',
  'EVOLUTION_API_KEY',
  'EVOLUTION_INSTANCE_PREFIX',
  'EVOLUTION_WEBHOOK_SECRET',
  'EVOLUTION_WEBHOOK_URL',
]

/** Render web service (apps/agent). Set by the Blueprint. */
export const AGENT_VARS = [
  'AGENT_INTERNAL_URL',
  'API_URL',
  'INTERNAL_SERVICE_SECRET',
  'LLM_ADAPTER',
  'LLM_API_KEY',
  'LLM_MODEL',
  'LLM_BASE_URL',
  'CONTENT_DEFAULT_LANGUAGE',
]

/** Everything `.env` needs for the whole stack to run locally. */
export const LOCAL_VARS = [
  'CLOUDFLARE_ENV',
  ...new Set([...WORKER_VARS, ...FRONTEND_VARS, ...AGENT_VARS]),
]

/**
 * Everything `.env.production` needs to deploy and migrate from a laptop.
 * CLOUDFLARE_API_TOKEN is deliberately absent: `pnpm cf:login` covers local
 * deploys with an OAuth token, and setting a token variable to a placeholder
 * would override that OAuth token and break wrangler.
 */
export const PRODUCTION_VARS = [
  'CLOUDFLARE_ENV',
  'CLOUDFLARE_ACCOUNT_ID',
  ...new Set([...WORKER_VARS, ...FRONTEND_VARS, ...AGENT_VARS]),
]

/** Values the Worker and the Render services must hold identically. */
export const MUST_MATCH = [
  'INTERNAL_SERVICE_SECRET',
  'EVOLUTION_API_KEY',
  'EVOLUTION_WEBHOOK_SECRET',
  'EVOLUTION_INSTANCE_PREFIX',
]

/**
 * Health endpoints, keyed by the variable holding each origin. `''` means the
 * service answers on its root path.
 */
export const HEALTH_CHECKS = [
  { name: 'api (Cloudflare Worker)', origin: 'API_URL', path: '/api/health' },
  { name: 'frontend (Render)', origin: 'APP_URL', path: '/' },
  { name: 'agent (Render)', origin: 'AGENT_INTERNAL_URL', path: '/health' },
  { name: 'evolution (Render)', origin: 'EVOLUTION_BASE_URL', path: '/' },
]
