import { signInternalRequest } from '@imno/runtime-config'
import { mastraConfig } from './config'

/**
 * Client for the API's internal data bridge.
 *
 * The agent runtime owns the model key but no database, so every read and write
 * goes through one HMAC-signed POST. Failures are returned as data (never
 * thrown) so a tool can hand the model a usable message instead of collapsing
 * the whole turn.
 */

const BRIDGE_PATH = '/api/internal/data'
const REQUEST_TIMEOUT_MS = 20_000

export type DataResult<T> = { ok: true; data: T } | { ok: false; error: string }

export async function callDataOperation<T = unknown>(
  tenantId: string,
  operation: string,
  params: Record<string, unknown> = {},
): Promise<DataResult<T>> {
  if (!mastraConfig.internalSecret) {
    return { ok: false, error: 'The agent runtime is missing INTERNAL_SERVICE_SECRET.' }
  }

  const body = JSON.stringify({ tenantId, operation, params })
  const signature = signInternalRequest(mastraConfig.internalSecret, {
    method: 'POST',
    path: BRIDGE_PATH,
    body,
  })

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const response = await fetch(`${mastraConfig.apiBaseUrl}${BRIDGE_PATH}`, {
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

    const payload = (await response.json().catch(() => null)) as {
      data?: T
      error?: { code?: string; message?: string }
    } | null

    if (!response.ok) {
      const detail = payload?.error?.message ?? payload?.error?.code ?? `status ${response.status}`
      return { ok: false, error: `Operation "${operation}" failed: ${detail}` }
    }
    return { ok: true, data: (payload?.data ?? {}) as T }
  } catch {
    return { ok: false, error: `Operation "${operation}" could not reach the platform API.` }
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Convenience wrapper for tools: returns the operation payload on success, or a
 * `{ error }` object the model can read and explain to the user.
 *
 * `T` is inferred from the caller's declared return type (each tool's
 * `outputSchema` union), so the bridge response is asserted into that shape at
 * this single boundary instead of at every call site. The runtime contract is
 * enforced on the API side by the operation catalogue.
 */
export async function dataOperationOrError<T>(
  tenantId: string,
  operation: string,
  params: Record<string, unknown> = {},
): Promise<T> {
  const result = await callDataOperation(tenantId, operation, params)
  return (result.ok ? result.data : { error: result.error }) as T
}
