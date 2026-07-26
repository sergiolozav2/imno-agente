import { type Result, type SafeError, ErrorCode, err, ok } from '@imno/contracts'
import { signInternalRequest } from '@imno/runtime-config'

/**
 * Client for the Mastra agent runtime.
 *
 * The agent owns the model key and its own memory; the API owns the database and
 * message delivery. So these calls carry only server-derived identity (tenant,
 * conversation, client, user) plus the incoming text, and get back reply text —
 * the API remains the single writer of messages and delivery state.
 */

const CLIENT_REPLY_PATH = '/internal/agent/client-reply'
const SYSTEM_CHAT_PATH = '/internal/agent/system-chat'
const SESSIONS_PATH = '/internal/agent/sessions'
const SESSION_READ_PATH = '/internal/agent/session'
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

export interface SystemChatRequest {
  tenantId: string
  tenantSlug: string
  userId: string
  message: string
  /** Continue an existing session; omit to start a new one. */
  threadId?: string
  language?: string
}

export interface SystemChatResponse {
  text: string
  threadId?: string
  toolCalls?: string[]
}

export interface SystemSessionSummary {
  threadId: string
  title: string
  createdAt: string
  updatedAt: string
}

export interface SystemSessionTranscript {
  threadId: string
  title: string
  messages: { role: string; text: string; createdAt: string }[]
}

export async function requestClientReply(
  config: AgentClientConfig,
  input: ClientReplyRequest,
): Promise<Result<ClientReplyResponse, SafeError>> {
  return postReplyToAgent<ClientReplyResponse>(config, CLIENT_REPLY_PATH, input)
}

/** One operator turn with the system agent, for the app UI or the platform line. */
export async function requestSystemChat(
  config: AgentClientConfig,
  input: SystemChatRequest,
): Promise<Result<SystemChatResponse, SafeError>> {
  return postReplyToAgent<SystemChatResponse>(config, SYSTEM_CHAT_PATH, input)
}

/** The operator's stored chat sessions, newest first. */
export async function requestSystemSessions(
  config: AgentClientConfig,
  input: { tenantId: string; userId: string; limit?: number },
): Promise<Result<{ sessions: SystemSessionSummary[] }, SafeError>> {
  return postToAgent(config, SESSIONS_PATH, input)
}

/** One stored session replayed as messages, for reopening a chat in the app. */
export async function requestSystemSession(
  config: AgentClientConfig,
  input: { tenantId: string; userId: string; threadId: string; limit?: number },
): Promise<Result<SystemSessionTranscript, SafeError>> {
  return postToAgent(config, SESSION_READ_PATH, input)
}

/** Reply endpoints additionally require non-empty text to be worth returning. */
async function postReplyToAgent<T extends { text: string }>(
  config: AgentClientConfig,
  path: string,
  input: unknown,
): Promise<Result<T, SafeError>> {
  const result = await postToAgent<T>(config, path, input)
  if (!result.ok) return result
  if (typeof result.value.text !== 'string' || result.value.text.trim().length === 0) {
    return err({ code: ErrorCode.ModelFailure, message: 'The agent produced an empty reply.' })
  }
  return result
}

async function postToAgent<T>(
  config: AgentClientConfig,
  path: string,
  input: unknown,
): Promise<Result<T, SafeError>> {
  const body = JSON.stringify(input)
  const signature = signInternalRequest(config.secret, {
    method: 'POST',
    path,
    body,
  })

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  let response: Response
  try {
    response = await fetch(`${config.baseUrl.replace(/\/$/, '')}${path}`, {
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

  const parsed = (await response.json().catch(() => null)) as T | null
  if (!response.ok || !parsed) {
    return err({ code: ErrorCode.ModelFailure, message: 'The agent runtime returned no reply.' })
  }

  return ok(parsed)
}
