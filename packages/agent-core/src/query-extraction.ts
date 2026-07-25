import type { PropertySearchQuery } from '@imno/domain'

/**
 * Deterministically extract a bounded property search query from free buyer
 * text. This keeps property retrieval in application code — the model never
 * chooses which tenant or which listings to read.
 */
export function extractPropertyQuery(text: string): PropertySearchQuery {
  const normalized = text.trim()
  const lower = normalized.toLowerCase()
  const query: PropertySearchQuery = { text: normalized, limit: 5 }

  // Listing reference like "101 Palm Ave" / "Ref 22B" — a leading number + words.
  const refMatch = normalized.match(
    /\b\d+[a-z]?\s+[A-Za-zÁÉÍÓÚÑáéíóúñ.'-]+(?:\s+[A-Za-zÁÉÍÓÚÑáéíóúñ.'-]+)?/,
  )
  if (refMatch) {
    query.reference = refMatch[0].trim()
  }

  // Bedrooms: "3 bed", "3 dormitorios", "3 habitaciones".
  const bedMatch = lower.match(/(\d+)\s*(?:bed|bedroom|dorm|dormitorio|habitacion|habitación|hab)/)
  if (bedMatch?.[1]) {
    query.minBedrooms = Number(bedMatch[1])
  }

  // Budget: "under 300000", "max 300k", "hasta 300000", "presupuesto 300000".
  const budgetMatch = lower.match(
    /(?:under|below|max|hasta|menos de|presupuesto(?: de)?)\s*\$?€?\s*([\d.,]+)\s*(k|mil)?/,
  )
  if (budgetMatch?.[1]) {
    let amount = Number(budgetMatch[1].replace(/[.,](?=\d{3}\b)/g, '').replace(',', '.'))
    if (budgetMatch[2]) amount *= 1000
    if (Number.isFinite(amount) && amount > 0) query.maxPrice = amount
  }

  return query
}
