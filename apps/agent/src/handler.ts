import { type Result, type SafeError, ErrorCode, err, httpForError, ok } from '@imno/contracts'
import type { PropertyFact } from '@imno/domain'
import type { AgentModelService, ComposeReplyInput } from '@imno/agent-core'
import { verifyInternalRequest } from '@imno/runtime-config'
import {
  listSystemSessions,
  readSystemSession,
  runClientReply,
  runSystemChat,
} from './mastra/runner'

/**
 * Framework-neutral request/response shapes. The thin node:http server in
 * server.ts adapts real sockets onto these; tests drive the handler directly.
 */
export interface AgentRequest {
  method: string
  path: string
  headers: Record<string, string | undefined>
  body: string
}

export interface AgentResponse {
  status: number
  json: unknown
}

export interface AgentHandler {
  handle(req: AgentRequest): Promise<AgentResponse>
}

export interface AgentHandlerDeps {
  secret: string
  modelService: AgentModelService
}

const COMPOSE_PATH = '/internal/agent/compose-reply'
const SYSTEM_CHAT_PATH = '/internal/agent/system-chat'
const CLIENT_REPLY_PATH = '/internal/agent/client-reply'
const SESSIONS_PATH = '/internal/agent/sessions'
const SESSION_READ_PATH = '/internal/agent/session'

/**
 * Builds the single-purpose agent handler: an unauthenticated health probe and
 * one HMAC-authenticated internal endpoint that composes a grounded reply.
 * Error responses only ever carry a safe ErrorCode (and the safe SafeError
 * message) — never secrets, prompts, or model internals.
 */
export function createAgentHandler(deps: AgentHandlerDeps): AgentHandler {
  const { secret, modelService } = deps

  return {
    async handle(req) {
      if (req.method === 'GET' && req.path === '/health') {
        return { status: 200, json: { status: 'ok', service: 'agent' } }
      }

      if (req.method === 'POST' && req.path === COMPOSE_PATH) {
        return composeReply(secret, modelService, req)
      }

      if (req.method === 'POST' && req.path === SYSTEM_CHAT_PATH) {
        return runVerified(secret, SYSTEM_CHAT_PATH, req, systemChat)
      }

      if (req.method === 'POST' && req.path === CLIENT_REPLY_PATH) {
        return runVerified(secret, CLIENT_REPLY_PATH, req, clientReply)
      }

      if (req.method === 'POST' && req.path === SESSIONS_PATH) {
        return runVerified(secret, SESSIONS_PATH, req, listSessions)
      }

      if (req.method === 'POST' && req.path === SESSION_READ_PATH) {
        return runVerified(secret, SESSION_READ_PATH, req, readSession)
      }

      return { status: 404, json: { error: { code: ErrorCode.ResourceNotFound } } }
    },
  }
}

async function composeReply(
  secret: string,
  modelService: AgentModelService,
  req: AgentRequest,
): Promise<AgentResponse> {
  const verified = verifyInternalRequest(secret, {
    method: 'POST',
    path: COMPOSE_PATH,
    body: req.body,
    timestamp: req.headers['x-internal-timestamp'] ?? '',
    nonce: req.headers['x-internal-nonce'] ?? '',
    signature: req.headers['x-internal-signature'] ?? '',
  })
  if (!verified.ok) {
    return { status: 401, json: { error: { code: ErrorCode.InternalAuthInvalid } } }
  }

  const parsed = parseComposeInput(req.body)
  if (!parsed.ok) {
    return { status: 422, json: { error: { code: ErrorCode.ValidationFailed } } }
  }

  const result = await modelService.composePropertyReply(parsed.value)
  if (!result.ok) {
    const status = httpForError[result.error.code] ?? 502
    return { status, json: { error: safeErrorBody(result.error) } }
  }

  return { status: 200, json: { reply: result.value } }
}

/**
 * Shared shape for the Mastra-backed endpoints: verify the internal signature,
 * parse JSON, then delegate. A thrown error becomes a non-disclosing
 * MODEL_FAILURE — model internals and prompts never reach the caller.
 */
async function runVerified(
  secret: string,
  path: string,
  req: AgentRequest,
  run: (body: Record<string, unknown>) => Promise<AgentResponse>,
): Promise<AgentResponse> {
  const verified = verifyInternalRequest(secret, {
    method: 'POST',
    path,
    body: req.body,
    timestamp: req.headers['x-internal-timestamp'] ?? '',
    nonce: req.headers['x-internal-nonce'] ?? '',
    signature: req.headers['x-internal-signature'] ?? '',
  })
  if (!verified.ok) {
    return { status: 401, json: { error: { code: ErrorCode.InternalAuthInvalid } } }
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(req.body)
  } catch {
    return { status: 422, json: { error: { code: ErrorCode.ValidationFailed } } }
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { status: 422, json: { error: { code: ErrorCode.ValidationFailed } } }
  }

  try {
    return await run(parsed as Record<string, unknown>)
  } catch {
    return { status: 502, json: { error: { code: ErrorCode.ModelFailure } } }
  }
}

function requiredString(body: Record<string, unknown>, key: string): string | null {
  const value = body[key]
  return typeof value === 'string' && value.trim().length > 0 ? value : null
}

function optionalString(body: Record<string, unknown>, key: string): string | undefined {
  const value = body[key]
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined
}

const invalid: AgentResponse = {
  status: 422,
  json: { error: { code: ErrorCode.ValidationFailed } },
}

/** Operator chat with the system agent (app UI and internal tooling). */
async function systemChat(body: Record<string, unknown>): Promise<AgentResponse> {
  const tenantId = requiredString(body, 'tenantId')
  const tenantSlug = requiredString(body, 'tenantSlug')
  const userId = requiredString(body, 'userId')
  const message = requiredString(body, 'message')
  if (!tenantId || !tenantSlug || !userId || !message) return invalid

  const result = await runSystemChat({
    tenantId,
    tenantSlug,
    userId,
    message,
    ...(optionalString(body, 'threadId') ? { threadId: body.threadId as string } : {}),
    ...(optionalString(body, 'language') ? { language: body.language as string } : {}),
  })
  return { status: 200, json: result }
}

/** Buyer-facing reply for one inbound WhatsApp message. */
async function clientReply(body: Record<string, unknown>): Promise<AgentResponse> {
  const tenantId = requiredString(body, 'tenantId')
  const tenantSlug = requiredString(body, 'tenantSlug')
  const conversationId = requiredString(body, 'conversationId')
  const clientId = requiredString(body, 'clientId')
  const message = requiredString(body, 'message')
  if (!tenantId || !tenantSlug || !conversationId || !clientId || !message) return invalid

  const result = await runClientReply({
    tenantId,
    tenantSlug,
    conversationId,
    clientId,
    message,
    ...(optionalString(body, 'language') ? { language: body.language as string } : {}),
  })
  return { status: 200, json: result }
}

/** Stored system-agent sessions for one operator. */
async function listSessions(body: Record<string, unknown>): Promise<AgentResponse> {
  const tenantId = requiredString(body, 'tenantId')
  const userId = requiredString(body, 'userId')
  if (!tenantId || !userId) return invalid

  const limit = typeof body.limit === 'number' ? body.limit : undefined
  const sessions = await listSystemSessions({
    tenantId,
    userId,
    ...(limit !== undefined ? { limit } : {}),
  })
  return { status: 200, json: { sessions } }
}

/** Replay one stored session so the app UI can reopen it. */
async function readSession(body: Record<string, unknown>): Promise<AgentResponse> {
  const tenantId = requiredString(body, 'tenantId')
  const userId = requiredString(body, 'userId')
  const threadId = requiredString(body, 'threadId')
  if (!tenantId || !userId || !threadId) return invalid

  const limit = typeof body.limit === 'number' ? body.limit : undefined
  const session = await readSystemSession({
    tenantId,
    userId,
    threadId,
    ...(limit !== undefined ? { limit } : {}),
  })
  if (!session) {
    return { status: 404, json: { error: { code: ErrorCode.ResourceNotFound } } }
  }
  return { status: 200, json: session }
}

function safeErrorBody(error: SafeError): { code: ErrorCode; message?: string } {
  return error.message ? { code: error.code, message: error.message } : { code: error.code }
}

/**
 * Parses and shallowly validates the compose request body. Required top-level
 * fields must be present with the right primitive shape; the buyer/fact content
 * is treated as untrusted data downstream, never as instructions.
 */
function parseComposeInput(body: string): Result<ComposeReplyInput, SafeError> {
  let raw: unknown
  try {
    raw = JSON.parse(body)
  } catch {
    return err({ code: ErrorCode.ValidationFailed, message: 'Request body was not valid JSON.' })
  }

  if (typeof raw !== 'object' || raw === null) {
    return err({ code: ErrorCode.ValidationFailed })
  }

  const candidate = raw as Record<string, unknown>
  const { language, buyerText, facts, conversationSummary } = candidate

  if (typeof language !== 'string' || language.length === 0) {
    return err({ code: ErrorCode.ValidationFailed })
  }
  if (typeof buyerText !== 'string' || buyerText.length === 0) {
    return err({ code: ErrorCode.ValidationFailed })
  }
  if (!Array.isArray(facts)) {
    return err({ code: ErrorCode.ValidationFailed })
  }
  if (conversationSummary !== undefined && typeof conversationSummary !== 'string') {
    return err({ code: ErrorCode.ValidationFailed })
  }

  const input: ComposeReplyInput = {
    language,
    buyerText,
    facts: facts as PropertyFact[],
    ...(conversationSummary !== undefined ? { conversationSummary } : {}),
  }
  return ok(input)
}
