/**
 * Deterministic, grounded fallback copy. Used when no tenant property matches
 * the buyer's query — we ask for clarification rather than inventing a listing.
 */
export function noMatchReply(language: string): string {
  if (language.toLowerCase().startsWith('en')) {
    return "I couldn't find a listing that matches your request. Could you share more details, such as the area, your budget, or a listing reference?"
  }
  return 'No encontré una propiedad que coincida con tu consulta. ¿Podrías darme más detalles, como la zona, tu presupuesto o una referencia de la propiedad?'
}
