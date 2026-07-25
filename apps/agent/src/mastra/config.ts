import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Configuration for the Mastra layer of the agent runtime.
 *
 * The runtime already validates its own env through `loadAgentConfig`; this
 * module only adds the Mastra-specific knobs (model id, memory store, the API
 * bridge target, and the operator-selected `system_` WhatsApp instance) and
 * keeps the defaults sane so a hackathon checkout boots without extra setup.
 */

/** Repo root, derived from this module's location rather than `process.cwd()`. */
export const repoRoot = fileURLToPath(new URL('../../../../', import.meta.url))

/**
 * Where the CLI in `scripts/` records the currently selected `system_`
 * Evolution instance. Keeping it on disk (instead of in env) lets an operator
 * switch instances without restarting the runtime.
 */
export const systemInstanceStateFile = resolve(repoRoot, '.system-whatsapp.json')

export interface SystemInstanceState {
  instanceName: string
  /** Instance-scoped Evolution token, when the provider returned one. */
  apiKey?: string
  selectedAt?: string
}

/**
 * Read the selected `system_` instance. Returns null when nothing is selected
 * yet; callers surface that as a plain "connect an instance first" message
 * rather than failing the whole turn.
 */
export function readSystemInstanceState(): SystemInstanceState | null {
  const fromEnv = process.env.SYSTEM_WHATSAPP_INSTANCE
  if (fromEnv && fromEnv.trim().length > 0) {
    return { instanceName: fromEnv.trim() }
  }
  try {
    const raw = readFileSync(systemInstanceStateFile, 'utf8')
    const parsed = JSON.parse(raw) as Partial<SystemInstanceState>
    if (typeof parsed.instanceName === 'string' && parsed.instanceName.length > 0) {
      return {
        instanceName: parsed.instanceName,
        ...(typeof parsed.apiKey === 'string' ? { apiKey: parsed.apiKey } : {}),
        ...(typeof parsed.selectedAt === 'string' ? { selectedAt: parsed.selectedAt } : {}),
      }
    }
    return null
  } catch {
    return null
  }
}

export interface MastraRuntimeConfig {
  /** Model router id, e.g. `deepseek/deepseek-chat`. */
  model: string
  /** Base URL of the Payload API that hosts the internal data bridge. */
  apiBaseUrl: string
  /** Shared secret for the HMAC-signed internal calls. */
  internalSecret: string
  /** libSQL URL backing agent threads and messages. */
  storageUrl: string
  /** Default reply language for buyer-facing output. */
  defaultLanguage: string
}

/**
 * DeepSeek is OpenAI-compatible and is exposed through Mastra's model router as
 * `deepseek/<model>`, which reads `DEEPSEEK_API_KEY`. The project stores that
 * key in the provider-neutral `LLM_API_KEY`, so mirror it across here instead
 * of asking operators to duplicate the value in their `.env`.
 */
export function loadMastraConfig(): MastraRuntimeConfig {
  const llmApiKey = process.env.LLM_API_KEY
  if (llmApiKey && !process.env.DEEPSEEK_API_KEY) {
    process.env.DEEPSEEK_API_KEY = llmApiKey
  }

  const rawModel = process.env.LLM_MODEL ?? 'deepseek-chat'
  // Accept either a bare provider model name or a full router id.
  const model = process.env.MASTRA_MODEL ?? (rawModel.includes('/') ? rawModel : `deepseek/${rawModel}`)

  return {
    model,
    apiBaseUrl: (process.env.API_URL ?? 'http://localhost:3001').replace(/\/$/, ''),
    internalSecret: process.env.INTERNAL_SERVICE_SECRET ?? '',
    storageUrl: process.env.MASTRA_STORAGE_URL ?? `file:${resolve(repoRoot, '.mastra/agent-memory.db')}`,
    defaultLanguage: process.env.CONTENT_DEFAULT_LANGUAGE ?? 'es',
  }
}

export const mastraConfig = loadMastraConfig()
