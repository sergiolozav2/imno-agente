/**
 * Admin-side Evolution API calls used by the `pnpm wa:*` CLI scripts.
 *
 * The frontend BFF has its own copy of the messaging-oriented subset
 * (`apps/frontend/src/lib/evolution.ts`); this one covers the provisioning
 * endpoints those scripts need — fetch, create, connect/QR, logout and delete —
 * and always authenticates with the global key, which is the only key Evolution
 * accepts on `/instance/*`.
 */

const REQUEST_TIMEOUT_MS = 20_000

/** Every system line is named with this prefix so it can never collide with a tenant's. */
export const SYSTEM_PREFIX = 'SYSTEM_'

/** Accepted webhook events (Evolution v2 uses UPPER_SNAKE names). */
const WEBHOOK_EVENTS = ['MESSAGES_UPSERT', 'MESSAGES_SET', 'CONNECTION_UPDATE']

export type ConnectionState = 'open' | 'connecting' | 'close'

export interface EvolutionEnv {
  baseUrl: string
  apiKey: string
  webhookUrl: string
  webhookSecret: string
  instancePrefix: string
}

export interface EvolutionInstance {
  name: string
  id: string | null
  token: string | null
  connectionState: ConnectionState
  rawState: string
  ownerJid: string | null
  profileName: string | null
  isSystem: boolean
}

export function loadEvolutionEnv(): EvolutionEnv {
  const baseUrl = (process.env.EVOLUTION_BASE_URL || '').replace(/\/$/, '')
  const apiKey = process.env.EVOLUTION_API_KEY || ''
  if (!baseUrl || !apiKey) {
    throw new Error('EVOLUTION_BASE_URL and EVOLUTION_API_KEY must be set.')
  }
  return {
    baseUrl,
    apiKey,
    webhookUrl: process.env.EVOLUTION_WEBHOOK_URL || '',
    webhookSecret: process.env.EVOLUTION_WEBHOOK_SECRET || '',
    instancePrefix: process.env.EVOLUTION_INSTANCE_PREFIX || 'imno-agent',
  }
}

export function readString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

function toConnectionState(raw: string): ConnectionState {
  if (raw === 'open') return 'open'
  if (raw === 'connecting') return 'connecting'
  return 'close'
}

async function request(
  env: EvolutionEnv,
  method: 'GET' | 'POST' | 'DELETE',
  path: string,
  body?: unknown,
): Promise<{ status: number; ok: boolean; data: unknown }> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const response = await fetch(`${env.baseUrl}${path}`, {
      method,
      headers: { apikey: env.apiKey, 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    })
    let data: unknown = null
    try {
      data = await response.json()
    } catch {
      data = null
    }
    return { status: response.status, ok: response.ok, data }
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    throw new Error(`cannot reach Evolution at ${env.baseUrl} (${reason})`)
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Evolution v2.2+ returns flat instance objects; older builds nest them under an
 * `instance` key with different field names. Normalise both.
 */
function normalizeInstance(raw: unknown): EvolutionInstance | null {
  if (typeof raw !== 'object' || raw === null) return null
  const outer = raw as Record<string, unknown>
  const nested = (
    typeof outer.instance === 'object' && outer.instance !== null ? outer.instance : outer
  ) as Record<string, unknown>

  const name = readString(nested.name) ?? readString(nested.instanceName)
  if (!name) return null

  const rawState =
    readString(nested.connectionStatus) ??
    readString(nested.status) ??
    readString(nested.state) ??
    'unknown'

  return {
    name,
    id: readString(nested.id) ?? readString(nested.instanceId),
    token: readString(nested.token) ?? readString(nested.apikey) ?? readString(nested.hash),
    connectionState: toConnectionState(rawState),
    rawState,
    ownerJid: readString(nested.ownerJid) ?? readString(nested.owner) ?? readString(nested.number),
    profileName: readString(nested.profileName),
    isSystem: name.startsWith(SYSTEM_PREFIX),
  }
}

/** All instances known to Evolution, system lines first, then alphabetical. */
export async function fetchInstances(env: EvolutionEnv): Promise<EvolutionInstance[]> {
  const { status, ok, data } = await request(env, 'GET', '/instance/fetchInstances')
  if (status === 401 || status === 403) {
    throw new Error(
      `Evolution rejected the global key (HTTP ${status}). EVOLUTION_API_KEY must match ` +
        "the server's AUTHENTICATION_API_KEY.",
    )
  }
  if (!ok) throw new Error(`fetchInstances returned HTTP ${status}`)

  return (Array.isArray(data) ? data : [])
    .map(normalizeInstance)
    .filter((instance): instance is EvolutionInstance => instance !== null)
    .sort((a, b) => {
      if (a.isSystem !== b.isSystem) return a.isSystem ? -1 : 1
      return a.name.localeCompare(b.name)
    })
}

export async function findInstance(
  env: EvolutionEnv,
  name: string,
): Promise<EvolutionInstance | null> {
  const instances = await fetchInstances(env)
  return instances.find((instance) => instance.name === name) ?? null
}

export interface CreatedInstance {
  alreadyExists: boolean
  externalInstanceId: string | null
  token: string | null
}

/**
 * Create the instance with the platform webhook already attached. A 403/409 means
 * the name is taken, which is treated as success so re-running is safe.
 */
export async function createInstance(
  env: EvolutionEnv,
  instanceName: string,
): Promise<CreatedInstance> {
  const { status, ok, data } = await request(env, 'POST', '/instance/create', {
    instanceName,
    integration: 'WHATSAPP-BAILEYS',
    qrcode: true,
    ...(env.webhookUrl
      ? {
          webhook: {
            url: env.webhookUrl,
            headers: { 'x-webhook-secret': env.webhookSecret },
            events: WEBHOOK_EVENTS,
          },
        }
      : {}),
  })

  if (status === 403 || status === 409) {
    return { alreadyExists: true, externalInstanceId: null, token: null }
  }
  if (!ok) throw new Error(`instance/create returned HTTP ${status}`)

  const body = (data ?? {}) as Record<string, unknown>
  const instance = (body.instance ?? {}) as Record<string, unknown>
  const hash = body.hash
  const token =
    readString(hash) ??
    (typeof hash === 'object' && hash !== null
      ? readString((hash as Record<string, unknown>).apikey)
      : null) ??
    readString(instance.token) ??
    readString(instance.apikey)

  return {
    alreadyExists: false,
    externalInstanceId:
      readString(instance.instanceId) ??
      readString(body.instanceId) ??
      readString(instance.id) ??
      readString(body.id),
    token,
  }
}

export interface PairingCode {
  /** The raw string encoded in the QR — this is what gets rendered in the terminal. */
  code: string | null
  /** Evolution's own PNG rendering, kept for callers that can display images. */
  base64: string | null
}

/** Ask Evolution for a fresh pairing code. Returns nulls once the line is already open. */
export async function getPairingCode(
  env: EvolutionEnv,
  instanceName: string,
): Promise<PairingCode> {
  const { data } = await request(
    env,
    'GET',
    `/instance/connect/${encodeURIComponent(instanceName)}`,
  )
  const body = (data ?? {}) as Record<string, unknown>
  return {
    code: readString(body.code) ?? readString(body.pairingCode),
    base64: readString(body.base64) ?? readString(body.qrcode),
  }
}

export async function getConnectionState(
  env: EvolutionEnv,
  instanceName: string,
): Promise<ConnectionState> {
  const { data } = await request(
    env,
    'GET',
    `/instance/connectionState/${encodeURIComponent(instanceName)}`,
  )
  const body = (data ?? {}) as Record<string, unknown>
  const instance = (body.instance ?? {}) as Record<string, unknown>
  const raw = readString(instance.state) ?? readString(body.state) ?? 'close'
  return toConnectionState(raw)
}

/** Log the paired phone out. Ignored when the instance is not connected. */
export async function logoutInstance(env: EvolutionEnv, instanceName: string): Promise<void> {
  await request(env, 'DELETE', `/instance/logout/${encodeURIComponent(instanceName)}`).catch(
    () => null,
  )
}

export async function deleteInstance(env: EvolutionEnv, instanceName: string): Promise<boolean> {
  const { status, ok } = await request(
    env,
    'DELETE',
    `/instance/delete/${encodeURIComponent(instanceName)}`,
  )
  if (status === 404) return false
  if (!ok) throw new Error(`instance/delete returned HTTP ${status}`)
  return true
}
