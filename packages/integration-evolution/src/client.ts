import { type Result, type SafeError, ErrorCode, err, ok } from '@imno/contracts'
import { stripWhatsAppSuffix } from '@imno/domain'

/**
 * Evolution API (WhatsApp) HTTP adapter.
 *
 * Every call authenticates with the instance-agnostic `apikey` header and is
 * bounded by a timeout, so a hung provider can never hold an inbound webhook
 * open. Failures come back as CHANNEL_FAILURE with a safe message: provider
 * response bodies are never forwarded to callers.
 */

const DEFAULT_TIMEOUT_MS = 15_000
const MEDIA_TIMEOUT_MS = 60_000

export interface EvolutionClientConfig {
  baseUrl: string
  apiKey: string
  timeoutMs?: number
}

export interface SendTextInput {
  instanceName: string
  /** Recipient in any WhatsApp or E.164 form; normalized before dialing. */
  to: string
  text: string
}

export interface SendTextResult {
  providerMessageId?: string
}

export interface SendMediaInput {
  instanceName: string
  /** Recipient in any WhatsApp or E.164 form; normalized before dialing. */
  to: string
  /**
   * Publicly reachable URL, or a bare base64 payload. Evolution fetches URLs
   * from its own host, so anything behind session auth will not resolve.
   */
  media: string
  mediatype: 'image' | 'video' | 'document' | 'audio'
  mimetype: string
  fileName: string
  /** Text shown under the media bubble. */
  caption?: string
}

export interface EvolutionClient {
  sendText(input: SendTextInput): Promise<Result<SendTextResult, SafeError>>
  sendMedia(input: SendMediaInput): Promise<Result<SendTextResult, SafeError>>
}

/**
 * Evolution addresses recipients as bare digits — no leading `+` and no
 * `@s.whatsapp.net` suffix. Our stored identity is E.164, so strip both.
 */
export function toEvolutionRecipient(raw: string): string {
  return stripWhatsAppSuffix(raw ?? '').replace(/^\+/, '')
}

function channelFailure(message: string): SafeError {
  return { code: ErrorCode.ChannelFailure, message }
}

export function createEvolutionClient(config: EvolutionClientConfig): EvolutionClient {
  const baseUrl = config.baseUrl.replace(/\/$/, '')
  const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS

  async function post(
    path: string,
    body: unknown,
    overrideTimeoutMs?: number,
  ): Promise<Result<unknown, SafeError>> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), overrideTimeoutMs ?? timeoutMs)

    let response: Response
    try {
      response = await fetch(`${baseUrl}${path}`, {
        method: 'POST',
        headers: {
          apikey: config.apiKey,
          'content-type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      })
    } catch {
      return err(channelFailure('The WhatsApp provider could not be reached.'))
    } finally {
      clearTimeout(timer)
    }

    const parsed = await response.json().catch(() => null)
    if (!response.ok) {
      return err(channelFailure(`The WhatsApp provider rejected the request (${response.status}).`))
    }
    return ok(parsed)
  }

  return {
    async sendText(input) {
      const number = toEvolutionRecipient(input.to)
      if (!number) {
        return err({ code: ErrorCode.InvalidPhone, message: 'Missing recipient phone number.' })
      }

      const result = await post(`/message/sendText/${encodeURIComponent(input.instanceName)}`, {
        number,
        text: input.text,
      })
      if (!result.ok) return err(result.error)

      return ok(providerMessageId(result.value))
    },

    async sendMedia(input) {
      const number = toEvolutionRecipient(input.to)
      if (!number) {
        return err({ code: ErrorCode.InvalidPhone, message: 'Missing recipient phone number.' })
      }

      const result = await post(
        `/message/sendMedia/${encodeURIComponent(input.instanceName)}`,
        {
          number,
          mediatype: input.mediatype,
          mimetype: input.mimetype,
          media: input.media,
          fileName: input.fileName,
          ...(input.caption ? { caption: input.caption } : {}),
        },
        // Evolution downloads the asset before relaying it, so this call is
        // bounded by a file transfer rather than by an API round trip.
        MEDIA_TIMEOUT_MS,
      )
      if (!result.ok) return err(result.error)

      return ok(providerMessageId(result.value))
    },
  }
}

function providerMessageId(response: unknown): SendTextResult {
  const key = (response as { key?: { id?: unknown } } | null)?.key
  return typeof key?.id === 'string' ? { providerMessageId: key.id } : {}
}
