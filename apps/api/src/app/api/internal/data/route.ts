import { ErrorCode, httpForError } from '@imno/contracts'
import { verifyInternalRequest } from '@imno/runtime-config'
import { getPayloadClient } from '@/lib/payload-client'
import { runDataOperation } from '@/lib/data-operations'

/**
 * Internal data bridge for the agent runtime.
 *
 * The agent holds the model key but no database credentials, so every read and
 * write it performs arrives here as one HMAC-signed operation. The signature
 * authenticates the *service*; the tenant id in the body is then applied as a
 * predicate by the operation catalogue, so a compromised prompt still cannot
 * reach another agency's rows.
 */

const BRIDGE_PATH = '/api/internal/data'

function jsonError(code: ErrorCode, message?: string): Response {
  return Response.json(
    { error: message ? { code, message } : { code } },
    { status: httpForError[code] },
  )
}

export async function POST(req: Request): Promise<Response> {
  const raw = await req.text()

  const verified = verifyInternalRequest(process.env.INTERNAL_SERVICE_SECRET ?? '', {
    method: 'POST',
    path: BRIDGE_PATH,
    body: raw,
    timestamp: req.headers.get('x-internal-timestamp') ?? '',
    nonce: req.headers.get('x-internal-nonce') ?? '',
    signature: req.headers.get('x-internal-signature') ?? '',
  })
  if (!verified.ok) return jsonError(ErrorCode.InternalAuthInvalid)

  let body: unknown
  try {
    body = JSON.parse(raw)
  } catch {
    return jsonError(ErrorCode.ValidationFailed)
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return jsonError(ErrorCode.ValidationFailed)
  }

  const { tenantId, operation, params } = body as {
    tenantId?: unknown
    operation?: unknown
    params?: unknown
  }
  if (typeof tenantId !== 'string' || tenantId.trim().length === 0) {
    return jsonError(ErrorCode.ValidationFailed, 'tenantId is required.')
  }
  if (typeof operation !== 'string' || operation.trim().length === 0) {
    return jsonError(ErrorCode.ValidationFailed, 'operation is required.')
  }

  const payload = await getPayloadClient()
  const result = await runDataOperation(
    { payload, tenantId, origin: new URL(req.url).origin },
    operation,
    params && typeof params === 'object' && !Array.isArray(params)
      ? (params as Record<string, unknown>)
      : {},
  )

  if (!result.ok) {
    return jsonError(result.error.code, result.error.message)
  }
  return Response.json({ data: result.value }, { status: 200 })
}
