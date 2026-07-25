import { type Result, ok, err, type ConfigInvalidError } from '@imno/contracts'
import { type EnvRecord, configInvalid, requireVars } from './env'

// -----------------------------------------------------------------------------
// Command-scoped configuration shapes. Each loader validates ONLY the variables
// its command needs, and returns a non-disclosing error naming the first
// offending variable. Values are never logged.
// -----------------------------------------------------------------------------

export interface WebConfig {
  appUrl: string
  apiUrl: string
}

export interface ApiConfig {
  appUrl: string
  apiUrl: string
  agentInternalUrl: string
  internalServiceSecret: string
  payloadSecret: string
  cloudflareEnv: string
  d1Binding: string
  r2Binding: string
}

export interface AgentConfig {
  agentInternalUrl: string
  internalServiceSecret: string
  llmAdapter: string
  llmApiKey: string
  llmModel: string
  llmBaseUrl: string
}

export interface EvolutionConfig {
  baseUrl: string
  publicUrl: string
  apiKey: string
  instancePrefix: string
  webhookSecret: string
  webhookUrl: string
}

export interface VideoConfig {
  ffmpegPath: string
  tempDir: string
  aspectRatio: string
  defaultMusic: string
  language: string
}

export interface DeferredMediaConfig {
  transcription: string
  voice: string
  imageEnhancement: string
}

/** Browser/BFF boundary — only the two public origins. */
export function loadWebConfig(env: EnvRecord = process.env): Result<WebConfig, ConfigInvalidError> {
  const required = requireVars(env, ['APP_URL', 'API_URL'])
  if (!required.ok) return err(configInvalid(required.variable))
  const { values } = required
  return ok({
    appUrl: values.APP_URL,
    apiUrl: values.API_URL,
  })
}

/** API server — origins, internal HMAC secret, Payload + Cloudflare bindings. */
export function loadApiConfig(env: EnvRecord = process.env): Result<ApiConfig, ConfigInvalidError> {
  const required = requireVars(env, [
    'APP_URL',
    'API_URL',
    'AGENT_INTERNAL_URL',
    'INTERNAL_SERVICE_SECRET',
    'PAYLOAD_SECRET',
    'CLOUDFLARE_ENV',
    'CLOUDFLARE_D1_BINDING',
    'CLOUDFLARE_R2_BINDING',
  ])
  if (!required.ok) return err(configInvalid(required.variable))
  const { values } = required
  return ok({
    appUrl: values.APP_URL,
    apiUrl: values.API_URL,
    agentInternalUrl: values.AGENT_INTERNAL_URL,
    internalServiceSecret: values.INTERNAL_SERVICE_SECRET,
    payloadSecret: values.PAYLOAD_SECRET,
    cloudflareEnv: values.CLOUDFLARE_ENV,
    d1Binding: values.CLOUDFLARE_D1_BINDING,
    r2Binding: values.CLOUDFLARE_R2_BINDING,
  })
}

/** Agent worker — internal auth plus the provider-neutral model settings. */
export function loadAgentConfig(
  env: EnvRecord = process.env,
): Result<AgentConfig, ConfigInvalidError> {
  const required = requireVars(env, [
    'AGENT_INTERNAL_URL',
    'INTERNAL_SERVICE_SECRET',
    'LLM_ADAPTER',
    'LLM_API_KEY',
    'LLM_MODEL',
    'LLM_BASE_URL',
  ])
  if (!required.ok) return err(configInvalid(required.variable))
  const { values } = required
  return ok({
    agentInternalUrl: values.AGENT_INTERNAL_URL,
    internalServiceSecret: values.INTERNAL_SERVICE_SECRET,
    llmAdapter: values.LLM_ADAPTER,
    llmApiKey: values.LLM_API_KEY,
    llmModel: values.LLM_MODEL,
    llmBaseUrl: values.LLM_BASE_URL,
  })
}

/** Evolution API (WhatsApp) integration. */
export function loadEvolutionConfig(
  env: EnvRecord = process.env,
): Result<EvolutionConfig, ConfigInvalidError> {
  const required = requireVars(env, [
    'EVOLUTION_BASE_URL',
    'EVOLUTION_PUBLIC_URL',
    'EVOLUTION_API_KEY',
    'EVOLUTION_INSTANCE_PREFIX',
    'EVOLUTION_WEBHOOK_SECRET',
    'EVOLUTION_WEBHOOK_URL',
  ])
  if (!required.ok) return err(configInvalid(required.variable))
  const { values } = required
  return ok({
    baseUrl: values.EVOLUTION_BASE_URL,
    publicUrl: values.EVOLUTION_PUBLIC_URL,
    apiKey: values.EVOLUTION_API_KEY,
    instancePrefix: values.EVOLUTION_INSTANCE_PREFIX,
    webhookSecret: values.EVOLUTION_WEBHOOK_SECRET,
    webhookUrl: values.EVOLUTION_WEBHOOK_URL,
  })
}

/** Local video rendering + default content language. */
export function loadVideoConfig(
  env: EnvRecord = process.env,
): Result<VideoConfig, ConfigInvalidError> {
  const required = requireVars(env, [
    'VIDEO_FFMPEG_PATH',
    'VIDEO_TEMP_DIR',
    'VIDEO_DEFAULT_ASPECT_RATIO',
    'VIDEO_DEFAULT_MUSIC',
    'CONTENT_DEFAULT_LANGUAGE',
  ])
  if (!required.ok) return err(configInvalid(required.variable))
  const { values } = required
  return ok({
    ffmpegPath: values.VIDEO_FFMPEG_PATH,
    tempDir: values.VIDEO_TEMP_DIR,
    aspectRatio: values.VIDEO_DEFAULT_ASPECT_RATIO,
    defaultMusic: values.VIDEO_DEFAULT_MUSIC,
    language: values.CONTENT_DEFAULT_LANGUAGE,
  })
}

/**
 * Deferred media providers. These carry valid sentinel values (`unsupported`,
 * `pass-through`) that are intentionally NOT treated as placeholders — they
 * only need to be present and non-empty.
 */
export function loadDeferredMediaConfig(
  env: EnvRecord = process.env,
): Result<DeferredMediaConfig, ConfigInvalidError> {
  const required = requireVars(env, [
    'TRANSCRIPTION_PROVIDER',
    'VOICE_PROVIDER',
    'IMAGE_ENHANCEMENT_PROVIDER',
  ])
  if (!required.ok) return err(configInvalid(required.variable))
  const { values } = required
  return ok({
    transcription: values.TRANSCRIPTION_PROVIDER,
    voice: values.VOICE_PROVIDER,
    imageEnhancement: values.IMAGE_ENHANCEMENT_PROVIDER,
  })
}

/** Server-only secret names that must never cross the browser boundary. */
const BROWSER_FORBIDDEN_SECRETS: readonly string[] = [
  'PAYLOAD_SECRET',
  'INTERNAL_SERVICE_SECRET',
  'EVOLUTION_API_KEY',
  'EVOLUTION_WEBHOOK_SECRET',
  'LLM_API_KEY',
]

const NEXT_PUBLIC_PREFIX = 'NEXT_PUBLIC_'

/**
 * Detects a server-only secret that has been exposed to the browser via a
 * `NEXT_PUBLIC_` prefix (e.g. `NEXT_PUBLIC_PAYLOAD_SECRET`). Returns the
 * offending key name, or null when no leak is present.
 */
export function findBrowserExposedSecret(env: EnvRecord = process.env): string | null {
  for (const key of Object.keys(env)) {
    if (!key.startsWith(NEXT_PUBLIC_PREFIX)) continue
    const remainder = key.slice(NEXT_PUBLIC_PREFIX.length)
    if (BROWSER_FORBIDDEN_SECRETS.includes(remainder)) {
      return key
    }
  }
  return null
}
