import { createTool } from '@mastra/core/tools'
import { z } from 'zod'

/**
 * Self-description.
 *
 * The catalogue is data, not prose baked into the prompt, so "what can you do?"
 * answers stay in sync with the tools that actually exist. Add a capability here
 * in the same change that adds its tool.
 */

export interface Capability {
  name: string
  description: string
  examples: string[]
  status: 'available' | 'preview'
}

export const systemCapabilities: Capability[] = [
  {
    name: 'Property search',
    description: 'Find and read your listings by text, zone, price, bedrooms, or status.',
    examples: [
      '¿Qué pisos tengo en Chamberí por debajo de 300.000?',
      'Muéstrame la propiedad REF-104',
    ],
    status: 'available',
  },
  {
    name: 'Property editing',
    description: 'Update a listing: price, status, title, description, zone, rooms, area.',
    examples: ['Marca REF-104 como reservada', 'Baja el precio del ático a 280.000'],
    status: 'available',
  },
  {
    name: 'Client search',
    description: 'Find buyer clients by name, phone, or email and check their lead temperature.',
    examples: ['Búscame a Juan', '¿Cuántos leads calientes tengo?'],
    status: 'available',
  },
  {
    name: 'Client editing',
    description: "Update a client's name, email, or interest level.",
    examples: ['Marca a Juan como cliente caliente', 'Añade el email de Marta'],
    status: 'available',
  },
  {
    name: 'Conversation search',
    description:
      'Read buyer conversations and search across every message to see what was said and when.',
    examples: ['¿Quién preguntó por el ático?', 'Resume la conversación con Juan'],
    status: 'available',
  },
  {
    name: 'WhatsApp outreach',
    description:
      'Draft and send a WhatsApp message to a client, logged in their conversation history.',
    examples: ['Escríbele a Juan sobre la propiedad REF-104'],
    status: 'available',
  },
  {
    name: 'Social media content',
    description:
      'Generate a ready-to-post title, description, caption, and hashtags for one property.',
    examples: ['Genera contenido para Instagram de REF-104'],
    status: 'available',
  },
  {
    name: 'Session recall',
    description: 'Look back at previous chats with me, by date or by topic.',
    examples: ['¿Recuerdas de qué hablamos ayer?'],
    status: 'available',
  },
  {
    name: 'Video generation',
    description:
      'Build a 61-second vertical reel from a property\u2019s photos, with an AI-written Spanish subtitle description and the agency name and phone on screen. Takes a couple of minutes and is saved on the property.',
    examples: ['Haz un vídeo de REF-104', '¿Ya está listo el vídeo del ático?'],
    status: 'available',
  },
]

export const listCapabilitiesTool = createTool({
  id: 'list-capabilities',
  description:
    'List what this assistant can do, with example phrasings. Call this whenever the user asks what you can do, what you are for, or how to use the platform.',
  inputSchema: z.object({}),
  outputSchema: z.object({
    capabilities: z.array(
      z.object({
        name: z.string(),
        description: z.string(),
        examples: z.array(z.string()),
        status: z.string(),
      }),
    ),
  }),
  execute: async () => ({ capabilities: systemCapabilities }),
})

export const capabilityTools = { listCapabilitiesTool }
