/**
 * Constant-time string comparison for webhook / internal secrets. Avoids the
 * early-exit timing side channel of `===`. Framework-neutral (no Node crypto
 * import so this stays portable across runtimes).
 */
export function constantTimeEqual(a: string, b: string): boolean {
  const aBytes = new TextEncoder().encode(a)
  const bBytes = new TextEncoder().encode(b)
  // Compare against the max length so length differences do not short-circuit.
  const length = Math.max(aBytes.length, bBytes.length)
  let mismatch = aBytes.length === bBytes.length ? 0 : 1
  for (let i = 0; i < length; i++) {
    const av = aBytes[i] ?? 0
    const bv = bBytes[i] ?? 0
    mismatch |= av ^ bv
  }
  return mismatch === 0
}

/**
 * Deterministic, dependency-free 53-bit hash (FNV-1a variant) used to derive a
 * stable event key when a provider omits a stable event/message id. Not for
 * security — only for idempotency de-duplication.
 */
export function stableHash(input: string): string {
  let h1 = 0xdeadbeef ^ input.length
  let h2 = 0x41c6ce57 ^ input.length
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  const hash = 4294967296 * (2097151 & h2) + (h1 >>> 0)
  return hash.toString(16)
}
