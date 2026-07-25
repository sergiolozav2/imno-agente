/**
 * Minimal server-side Evolution API client for the frontend BFF.
 *
 * This mirrors the endpoints used by `@imno/integration-evolution` but is kept
 * local so the frontend does not need to pull in the full gateway package.
 * The API key is read from server-only env and never sent to the browser.
 */

const DEFAULT_TIMEOUT_MS = 15_000

/** Accepted webhook events (Evolution v2 uses UPPER_SNAKE names). */
const WEBHOOK_EVENTS = ['MESSAGES_UPSERT', 'MESSAGES_SET']

export type ConnectionState = 'open' | 'connecting' | 'close'

interface EvolutionConfig {
  baseUrl: string
  apiKey: string
  webhookUrl: string
  webhookSecret: string
}

/** Read + validate the Evolution config from server env. Throws if missing. */
function getConfig(): EvolutionConfig {
  const baseUrl = process.env.EVOLUTION_BASE_URL
  const apiKey = process.env.EVOLUTION_API_KEY
  if (!baseUrl || !apiKey) {
    throw new Error('EVOLUTION_BASE_URL and EVOLUTION_API_KEY must be configured')
  }
  return {
    baseUrl: baseUrl.replace(/\/$/, ''),
    apiKey,
    webhookUrl: process.env.EVOLUTION_WEBHOOK_URL || '',
    webhookSecret: process.env.EVOLUTION_WEBHOOK_SECRET || '',
  }
}

/** Bounded request to Evolution. Returns parsed JSON plus the HTTP status. */
async function request(
  method: 'GET' | 'POST',
  path: string,
  body?: unknown,
): Promise<{ status: number; ok: boolean; data: unknown }> {
  const { baseUrl, apiKey } = getConfig()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS)

  try {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: { apikey: apiKey, 'Content-Type': 'application/json' },
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
  } finally {
    clearTimeout(timer)
  }
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

/**
 * Create the Evolution instance if it does not already exist. Evolution returns
 * a 403/409 when the instance name is taken, which we treat as success so the
 * flow stays idempotent.
 */
export async function createInstance(
  instanceName: string,
): Promise<{ ok: boolean; alreadyExists: boolean; externalInstanceId: string | null }> {
  const { webhookUrl, webhookSecret } = getConfig()
  const { status, ok, data } = await request('POST', '/instance/create', {
    instanceName,
    integration: 'WHATSAPP-BAILEYS',
    qrcode: true,
    ...(webhookUrl
      ? {
          webhook: {
            url: webhookUrl,
            headers: { 'x-webhook-secret': webhookSecret },
            events: WEBHOOK_EVENTS,
          },
        }
      : {}),
  })

  if (status === 403 || status === 409) {
    return { ok: true, alreadyExists: true, externalInstanceId: null }
  }

  const body = (data ?? {}) as Record<string, unknown>
  const instance = (body.instance ?? {}) as Record<string, unknown>
  const externalInstanceId =
    readString(instance.instanceId) ??
    readString(body.instanceId) ??
    readString(instance.id) ??
    readString(body.id)

  return { ok, alreadyExists: false, externalInstanceId }
}

/** Fetch the current QR code as a data URL, or null if none is available. */
export async function getQrCode(instanceName: string): Promise<string | null> {
  const { data } = await request('GET', `/instance/connect/${encodeURIComponent(instanceName)}`)
  const body = (data ?? {}) as Record<string, unknown>
  const raw = readString(body.base64) ?? readString(body.qrcode) ?? readString(body.code)
  if (!raw) return null
  // Evolution may return either a bare base64 string or a full data URL.
  return raw.startsWith('data:') ? raw : `data:image/png;base64,${raw}`
}

/** Fetch the raw Evolution connection state. */
export async function getConnectionState(instanceName: string): Promise<ConnectionState> {
  const { data } = await request(
    'GET',
    `/instance/connectionState/${encodeURIComponent(instanceName)}`,
  )
  const body = (data ?? {}) as Record<string, unknown>
  const instance = (body.instance ?? {}) as Record<string, unknown>
  const raw = instance.state ?? body.state
  if (raw === 'open' || raw === 'connecting' || raw === 'close') return raw
  return 'close'
}

/** Map Evolution's raw state to the value the client UI expects. */
export function toClientState(state: ConnectionState): 'connected' | 'connecting' | 'disconnected' {
  if (state === 'open') return 'connected'
  if (state === 'connecting') return 'connecting'
  return 'disconnected'
}
