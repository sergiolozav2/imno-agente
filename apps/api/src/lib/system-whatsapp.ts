import type { Payload } from 'payload'

/**
 * Accessors for the singleton `system-whatsapp` global.
 *
 * Everything that needs the platform's own WhatsApp line goes through here so
 * the shape of the global stays in one place: the CLI writes it, the outbound
 * send path reads it.
 */

export interface SystemWhatsappState {
  instanceName: string | null
  externalInstanceId: string | null
  apiKey: string | null
  connectionState: 'open' | 'connecting' | 'close'
  webhookConfigured: boolean
  connectedNumber: string | null
  connectedAt: string | null
}

export interface SystemWhatsappUpdate {
  instanceName?: string | null
  externalInstanceId?: string | null
  apiKey?: string | null
  connectionState?: 'open' | 'connecting' | 'close'
  webhookConfigured?: boolean
  connectedNumber?: string | null
  connectedAt?: string | null
}

const EMPTY: SystemWhatsappState = {
  instanceName: null,
  externalInstanceId: null,
  apiKey: null,
  connectionState: 'close',
  webhookConfigured: false,
  connectedNumber: null,
  connectedAt: null,
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

export async function readSystemWhatsapp(payload: Payload): Promise<SystemWhatsappState> {
  const doc = (await payload
    .findGlobal({ slug: 'system-whatsapp', depth: 0, overrideAccess: true })
    .catch(() => null)) as Record<string, unknown> | null
  if (!doc) return EMPTY

  const state = doc.connectionState
  return {
    instanceName: text(doc.instanceName),
    externalInstanceId: text(doc.externalInstanceId),
    apiKey: text(doc.apiKey),
    connectionState: state === 'open' || state === 'connecting' ? state : 'close',
    webhookConfigured: doc.webhookConfigured === true,
    connectedNumber: text(doc.connectedNumber),
    connectedAt: text(doc.connectedAt),
  }
}

export async function writeSystemWhatsapp(
  payload: Payload,
  data: SystemWhatsappUpdate,
): Promise<SystemWhatsappState> {
  await payload.updateGlobal({
    slug: 'system-whatsapp',
    data: data as Record<string, unknown>,
    depth: 0,
    overrideAccess: true,
  })
  return readSystemWhatsapp(payload)
}

/** Forget the current line. The global row stays, blanked, so reads keep working. */
export async function clearSystemWhatsapp(payload: Payload): Promise<void> {
  await writeSystemWhatsapp(payload, {
    instanceName: null,
    externalInstanceId: null,
    apiKey: null,
    connectionState: 'close',
    webhookConfigured: false,
    connectedNumber: null,
    connectedAt: null,
  })
}

/** The system line's instance name, only when it is actually paired. */
export async function connectedSystemInstanceName(payload: Payload): Promise<string | null> {
  const state = await readSystemWhatsapp(payload)
  return state.connectionState === 'open' ? state.instanceName : null
}
