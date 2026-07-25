/**
 * These collections use numeric ids while domain code carries ids as strings.
 * Convert at the persistence boundary so relationship validation accepts them.
 */
export function toId(id: string): number {
  return Number(id)
}

/**
 * Widen a Payload document to an indexable record so projections can read
 * fields generically. Projections re-assert every field they emit, so this
 * loses no safety that the generated types were providing.
 */
export function asRecord(doc: unknown): Record<string, unknown> {
  return doc as unknown as Record<string, unknown>
}
