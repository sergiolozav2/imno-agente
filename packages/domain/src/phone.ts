import { parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js'
import { type Result, type SafeError, ErrorCode, err, ok } from '@imno/contracts'

export interface NormalizedPhone {
  e164: string
}

/**
 * Strip WhatsApp/provider suffixes (e.g. `34600...@s.whatsapp.net`, device
 * markers like `:12`) so the raw provider identifier can be normalized.
 */
export function stripWhatsAppSuffix(raw: string): string {
  return raw.split('@')[0]?.split(':')[0]?.trim() ?? ''
}

/**
 * Normalize a supported phone input into a single E.164 identity.
 *
 * WhatsApp/provider identifiers (`remoteJid`) are always full international
 * numbers in E.164 digits *without* the leading `+` (e.g. `59176820989`).
 * Parsing those with a tenant country context corrupts them (a Bolivian
 * `591...` number parsed as `ES` becomes an invalid `+3459...`). So we try an
 * international-first parse (prepend `+`) and only fall back to the tenant's
 * country context for genuinely national-format input.
 *
 * Returns INVALID_PHONE for empty/unsupported input. Identity is
 * `(tenantId, e164)` — the same e164 may exist across tenants.
 */
export function normalizePhone(raw: string, tenantCountry: string): Result<NormalizedPhone, SafeError> {
  const cleaned = stripWhatsAppSuffix(raw ?? '')
  if (!cleaned) {
    return err({ code: ErrorCode.InvalidPhone, message: 'Empty phone input.' })
  }

  // International-first: a provider JID is already a complete E.164 number.
  const digits = cleaned.replace(/^\+/, '')
  const international = parsePhoneNumberFromString(`+${digits}`)
  if (international?.isValid()) {
    return ok({ e164: international.number })
  }

  // Fall back to the tenant country for national-format input (e.g. web chat).
  const country = tenantCountry.trim().toUpperCase() as CountryCode
  const parsed = parsePhoneNumberFromString(cleaned, country)
  if (!parsed || !parsed.isValid()) {
    return err({ code: ErrorCode.InvalidPhone, message: 'Unsupported or invalid phone number.' })
  }
  return ok({ e164: parsed.number })
}
