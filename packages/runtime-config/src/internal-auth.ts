import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto'
import { type Result, type SafeError, ErrorCode, err, ok } from '@imno/contracts'

/**
 * Server-only internal request authentication for API <-> agent calls. The
 * signed material is a timestamp, nonce, method, path, and a body digest —
 * never a raw secret or session. The receiver rejects stale timestamps and
 * verifies the HMAC with a constant-time comparison.
 *
 * This is service authentication only; tenant authorization is repeated when
 * the API data ports receive the tenant id.
 */

export interface InternalSignatureParts {
  timestamp: string
  nonce: string
  signature: string
}

export interface SignInput {
  method: string
  path: string
  body: string
  timestamp?: number
  nonce?: string
}

const DEFAULT_MAX_SKEW_MS = 5 * 60 * 1000

function digest(secret: string, payload: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex')
}

function canonicalPayload(parts: {
  timestamp: string
  nonce: string
  method: string
  path: string
  body: string
}): string {
  const bodyHash = createHmac('sha256', 'imno-body').update(parts.body).digest('hex')
  return [parts.timestamp, parts.nonce, parts.method.toUpperCase(), parts.path, bodyHash].join('.')
}

/** Produce the signature parts to attach as request headers. */
export function signInternalRequest(secret: string, input: SignInput): InternalSignatureParts {
  const timestamp = String(input.timestamp ?? Date.now())
  const nonce = input.nonce ?? randomUUID()
  const signature = digest(
    secret,
    canonicalPayload({ timestamp, nonce, method: input.method, path: input.path, body: input.body }),
  )
  return { timestamp, nonce, signature }
}

export interface VerifyInput {
  method: string
  path: string
  body: string
  timestamp: string
  nonce: string
  signature: string
}

export interface VerifyOptions {
  maxSkewMs?: number
  now?: number
}

/** Verify an internal request signature. Returns INTERNAL_AUTH_INVALID on failure. */
export function verifyInternalRequest(
  secret: string,
  input: VerifyInput,
  options: VerifyOptions = {},
): Result<void, SafeError> {
  const maxSkew = options.maxSkewMs ?? DEFAULT_MAX_SKEW_MS
  const now = options.now ?? Date.now()

  const ts = Number(input.timestamp)
  if (!Number.isFinite(ts) || Math.abs(now - ts) > maxSkew) {
    return err({ code: ErrorCode.InternalAuthInvalid, message: 'Stale or invalid timestamp.' })
  }

  const expected = digest(
    secret,
    canonicalPayload({
      timestamp: input.timestamp,
      nonce: input.nonce,
      method: input.method,
      path: input.path,
      body: input.body,
    }),
  )

  const a = Buffer.from(expected, 'utf8')
  const b = Buffer.from(input.signature ?? '', 'utf8')
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return err({ code: ErrorCode.InternalAuthInvalid, message: 'Invalid internal signature.' })
  }

  // TODO: Task 5.2 - a persisted/in-memory nonce store would reject replays; the
  // MVP relies on timestamp skew + durable per-message idempotency instead.
  return ok(undefined)
}
