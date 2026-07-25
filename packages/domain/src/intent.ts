/**
 * Deterministic high-intent detection. This is the conservative, dependency-free
 * layer that guarantees the demo phrase always classifies as High. The model
 * classifier (agent-core) may raise intent further, but must never downgrade a
 * deterministic High.
 *
 * "High intent" means explicit near-term purchase readiness.
 */

/** The exact demo phrase that MUST resolve to High and set the buyer to Hot. */
export const DEMO_HIGH_INTENT_PHRASE = 'I can pay cash this week'

const HIGH_INTENT_PATTERNS: RegExp[] = [
  /\bi can pay cash this week\b/i,
  /\bpay(ing)?\s+(in\s+)?cash\b.*\b(today|this week|now|immediately)\b/i,
  /\b(ready|want)\s+to\s+buy\b.*\b(today|this week|now)\b/i,
  /\bclose\s+the\s+deal\s+(today|this week|now)\b/i,
  /\bpuedo pagar (al contado|en efectivo) esta semana\b/i,
  /\bquiero comprar(la|lo)?\s+(ya|hoy|esta semana)\b/i,
]

export function normalizeIntentText(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

/**
 * Returns true when the buyer text communicates immediate purchase readiness.
 */
export function classifyHighIntentDeterministic(text: string): boolean {
  const normalized = normalizeIntentText(text ?? '')
  if (!normalized) return false
  return HIGH_INTENT_PATTERNS.some((pattern) => pattern.test(normalized))
}
