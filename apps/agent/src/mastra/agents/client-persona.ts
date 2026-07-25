/**
 * Personalization for the customer-facing WhatsApp agent.
 *
 * Each tenant that connects its own WhatsApp number turns that number into an
 * agent, and agencies will eventually edit this from the settings UI. Until that
 * screen exists, the shape lives here as a constant so the prompt already reads
 * from a structured record instead of hard-coded strings — swapping the source
 * for a Payload collection later means changing `resolveClientPersona` only.
 */

export interface ClientAgentPersona {
  /** How the assistant introduces itself. */
  assistantName: string
  /** Agency name used in replies. */
  businessName: string
  /** Reply language (ISO code). */
  language: string
  /** Voice guidance appended to the instructions. */
  tone: string
  /** Used the first time a buyer writes in. */
  greeting: string
  /** Free-form agency facts the assistant may state (hours, address, policy). */
  businessNotes: string[]
  /** What to say when a buyer wants a human. */
  humanHandoffLine: string
  /** Hard cap on reply length; WhatsApp rewards brevity. */
  maxReplyCharacters: number
}

/** TODO: replace with a per-tenant record once the settings UI ships. */
export const DEFAULT_CLIENT_AGENT_PERSONA: ClientAgentPersona = {
  assistantName: 'Ana',
  businessName: 'la inmobiliaria',
  language: 'es',
  tone: 'Cercano y profesional. Tuteo, frases cortas, sin tecnicismos y sin presionar.',
  greeting: '¡Hola! Soy Ana, del equipo de la inmobiliaria. ¿En qué zona estás buscando?',
  businessNotes: [
    'Atendemos consultas por WhatsApp todos los días.',
    'Las visitas se coordinan con un agente humano.',
  ],
  humanHandoffLine: 'Te paso con un agente del equipo para que lo veáis en detalle.',
  maxReplyCharacters: 600,
}

/**
 * Per-tenant overrides. Empty today: every connected number uses the default
 * persona until agencies can edit their own.
 */
const personaOverrides: Record<string, Partial<ClientAgentPersona>> = {}

export function resolveClientPersona(tenantSlug?: string): ClientAgentPersona {
  const override = tenantSlug ? personaOverrides[tenantSlug] : undefined
  return override ? { ...DEFAULT_CLIENT_AGENT_PERSONA, ...override } : DEFAULT_CLIENT_AGENT_PERSONA
}

/** Render the persona as the prompt block the client agent reads. */
export function renderPersonaBlock(persona: ClientAgentPersona): string {
  return [
    `Te llamas ${persona.assistantName} y atiendes el WhatsApp de ${persona.businessName}.`,
    `Idioma de respuesta: ${persona.language}.`,
    `Tono: ${persona.tone}`,
    `Si es el primer mensaje de la conversación, preséntate así: "${persona.greeting}"`,
    persona.businessNotes.length > 0
      ? `Datos de la agencia que puedes mencionar: ${persona.businessNotes.join(' ')}`
      : '',
    `Si piden hablar con una persona: "${persona.humanHandoffLine}"`,
    `Nunca superes ${persona.maxReplyCharacters} caracteres por respuesta.`,
  ]
    .filter((line) => line.length > 0)
    .join('\n')
}
