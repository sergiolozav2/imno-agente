/**
 * Personalization for the customer-facing WhatsApp agent.
 *
 * Each tenant that connects its own WhatsApp number turns that number into an
 * agent, and each agency edits how that agent sounds from the settings UI. The
 * edited record lives in Payload on the tenant; the API loads it and hands it to
 * this service with the turn, so nothing here reads a database.
 *
 * The default below is a complete, working persona rather than a placeholder,
 * and a tenant record is applied over it field by field. An agency that fills in
 * only an assistant name therefore changes only the name, and one that fills in
 * nothing still gets an assistant that behaves.
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

/** What an agency may override. Absent fields keep the default. */
export type ClientPersonaOverride = Partial<ClientAgentPersona>

/**
 * The opening line an agency gets when it has not written its own.
 *
 * Derived from the names rather than fixed, because a hard-coded greeting is how
 * an agency that renamed its assistant to Carmen still ends up with a bot that
 * says "soy Ana" on the first message.
 */
export function defaultGreeting(assistantName: string, businessName: string): string {
  return `¡Hola! Soy ${assistantName}, del equipo de ${businessName}. ¿En qué zona estás buscando?`
}

export const DEFAULT_CLIENT_AGENT_PERSONA: ClientAgentPersona = {
  assistantName: 'Ana',
  businessName: 'la inmobiliaria',
  language: 'es',
  tone: 'Cercano y profesional. Tuteo, frases cortas, sin tecnicismos y sin presionar.',
  greeting: defaultGreeting('Ana', 'la inmobiliaria'),
  businessNotes: [
    'Atendemos consultas por WhatsApp todos los días.',
    'Las visitas se coordinan con un agente humano.',
  ],
  humanHandoffLine: 'Te paso con un agente del equipo para que lo veáis en detalle.',
  maxReplyCharacters: 600,
}

/**
 * Merge a tenant's saved persona over the default.
 *
 * Values arrive from a request body, so each one is checked for the shape the
 * prompt expects — a blank field an agency left empty must fall through to the
 * default rather than erase it.
 */
export function resolveClientPersona(override?: unknown): ClientAgentPersona {
  if (!override || typeof override !== 'object') return DEFAULT_CLIENT_AGENT_PERSONA
  const raw = override as Record<string, unknown>

  const persona = { ...DEFAULT_CLIENT_AGENT_PERSONA }
  for (const key of [
    'assistantName',
    'businessName',
    'language',
    'tone',
    'greeting',
    'humanHandoffLine',
  ] as const) {
    const value = raw[key]
    if (typeof value === 'string' && value.trim().length > 0) {
      persona[key] = value.trim()
    }
  }

  // Only an agency that wrote its own greeting keeps it verbatim; otherwise the
  // default is rebuilt so it names whoever this assistant actually is.
  const wroteGreeting = typeof raw.greeting === 'string' && raw.greeting.trim().length > 0
  if (!wroteGreeting) {
    persona.greeting = defaultGreeting(persona.assistantName, persona.businessName)
  }

  if (Array.isArray(raw.businessNotes)) {
    const notes = raw.businessNotes
      .filter((note): note is string => typeof note === 'string')
      .map((note) => note.trim())
      .filter((note) => note.length > 0)
    // An agency that clears every note means it, so an empty list is honoured.
    persona.businessNotes = notes
  }

  const maxCharacters = raw.maxReplyCharacters
  if (typeof maxCharacters === 'number' && Number.isFinite(maxCharacters) && maxCharacters > 0) {
    persona.maxReplyCharacters = Math.min(Math.round(maxCharacters), 4000)
  }

  return persona
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
