import { type ConfigInvalidError, ErrorCode } from '@imno/contracts'

/**
 * A read-only view of environment variables. Defaults to `process.env` at the
 * loader boundary, but every loader accepts an explicit record for testability.
 */
export type EnvRecord = Record<string, string | undefined>

/**
 * Documented placeholder prefix used throughout `.env.sample`. A value that
 * still begins with this prefix means the operator has not filled it in yet and
 * must be treated as missing.
 */
const PLACEHOLDER_PREFIX = 'replace-with-'

/**
 * Builds the non-disclosing config error. Only the variable NAME is carried;
 * the offending value is never captured or logged.
 */
export function configInvalid(variable: string): ConfigInvalidError {
  return { code: ErrorCode.ConfigInvalid, variable }
}

/**
 * Result of {@link requireVars}: either the first offending variable name, or
 * the collected values keyed by their variable names.
 */
type RequireResult<N extends readonly string[]> =
  | { ok: true; values: Record<N[number], string> }
  | { ok: false; variable: N[number] }

/**
 * Validates that every requested variable is present, non-empty, and not a
 * leftover placeholder. Returns the FIRST offending name (never a value) or the
 * collected values. A variable is invalid when it is undefined, empty/whitespace,
 * or still holds a documented `replace-with-` placeholder.
 */
export function requireVars<const N extends readonly string[]>(
  env: EnvRecord,
  names: N,
): RequireResult<N> {
  const values = {} as Record<N[number], string>
  for (const name of names) {
    const value = env[name]
    if (value === undefined) {
      return { ok: false, variable: name }
    }
    const trimmed = value.trim()
    if (trimmed.length === 0 || trimmed.startsWith(PLACEHOLDER_PREFIX)) {
      return { ok: false, variable: name }
    }
    ;(values as Record<string, string>)[name] = value
  }
  return { ok: true, values }
}
