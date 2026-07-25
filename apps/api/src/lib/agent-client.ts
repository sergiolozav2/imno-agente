import { type Result, type SafeError, ErrorCode, err, ok } from '@imno/contracts'
import { signInternalRequest } from '@imno/runtime-config'

/**
 * Client for the Mastra agent runtime.
 *
 * The agent owns the model key and its own memory; the API owns the database and
 * message delivery. So this call carries only server-derived identity (tenant,
 * conversation, client) plus the buyer text, and gets back reply text — the API
 * remains the single writer of messages and delivery state.
 */

const CLIENT_REPLY_PATH = '/internal/agent/client-reply'
const REQUEST_TIMEOUT_MS = 60_000

export interface ClientReplyRequest {
  tenantId: string
  tenantSlug: string
  conversationId: string
  clientId: string
  message: string
  language?: string
}

export interface ClientReplyResponse {
  text: string
  threadId?: string
  leadStatus?: string
  toolCalls?: string[]
}

export interface AgentClientConfig {
  baseUrl: string
  secret: string
}

export async function requestClientReply(
  config: AgentClientConfig,
  input: ClientReplyRequest,
): Promise<Result<ClientReplyResponse, SafeError>> {
  const body = JSON.stringify(input)
  const signature = signInternalRequest(config.secret, {
    method: 'POST',
    path: CLIENT_REPLY_PATH,
    body,
  })

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  let response: Response
  try {
    response = await fetch(`${config.baseUrl.replace(/\/$/, '')}${CLIENT_REPLY_PATH}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-internal-timestamp': signature.timestamp,
        'x-internal-nonce': signature.nonce,
        'x-internal-signature': signature.signature,
      },
      body,
      signal: controller.signal,
    })
  } catch {
    return err({ code: ErrorCode.ModelFailure, message: 'The agent runtime is unreachable.' })
  } finally {
    clearTimeout(timer)
  }

  const parsed = (await response.json().catch(() => null)) as ClientReplyResponse | null
  if (!response.ok || !parsed || typeof parsed.text !== 'string') {
    return err({ code: ErrorCode.ModelFailure, message: 'The agent runtime returned no reply.' })
  }
  if (parsed.text.trim().length === 0) {
    return err({ code: ErrorCode.ModelFailure, message: 'The agent produced an empty reply.' })
  }

  return ok(parsed)
}
