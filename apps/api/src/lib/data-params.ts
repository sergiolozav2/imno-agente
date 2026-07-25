/**
 * Small readers for untrusted bridge parameters.
 *
 * The agent runtime is authenticated as a service but its params originate from
 * model output, so every value is coerced and range-limited here rather than
 * trusted. Deliberately dependency-free: this runs inside the Payload/Next
 * bundle where the workspace does not expose a validator.
 */

export type Params = Record<string, unknown>

export function optionalText(params: Params, key: string): string | undefined {
  const value = params[key]
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined
}

export function requiredText(params: Params, key: string): string | null {
  return optionalText(params, key) ?? null
}

export function optionalNumber(params: Params, key: string): number | undefined {
  const value = params[key]
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return undefined
}

/** Clamp a model-supplied page size into a server-owned range. */
export function boundedLimit(params: Params, fallback: number, max: number): number {
  const raw = optionalNumber(params, 'limit')
  if (raw === undefined) return fallback
  return Math.min(Math.max(Math.trunc(raw), 1), max)
}

export function optionalEnum<T extends string>(
  params: Params,
  key: string,
  allowed: readonly T[],
): T | undefined {
  const value = optionalText(params, key)
  return value !== undefined && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : undefined
}

export function objectParam(params: Params, key: string): Params {
  const value = params[key]
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Params) : {}
}

export function nullableString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

export function nullableNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

export function asIsoString(value: unknown): string {
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'string') return value
  return new Date(0).toISOString()
}

/** Relationship fields arrive as an id or a populated doc depending on depth. */
export function relationshipId(value: unknown): string {
  if (value && typeof value === 'object') {
    return String((value as { id?: unknown }).id ?? '')
  }
  return value === undefined || value === null ? '' : String(value)
}
