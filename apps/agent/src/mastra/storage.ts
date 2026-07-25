import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { LibSQLStore } from '@mastra/libsql'
import { Memory } from '@mastra/memory'
import { mastraConfig } from './config'

/**
 * Agent-side persistence.
 *
 * This store holds *agent* conversation threads: the operator's chats with the
 * system agent and the working context of each WhatsApp thread. It is not a
 * second copy of tenant data — properties, clients, and CRM messages stay in
 * Payload and are always read live through the internal data bridge. Keeping
 * the boundary sharp means memory can be wiped without losing business records.
 */

function ensureParentDirectory(url: string): void {
  if (!url.startsWith('file:')) return
  try {
    mkdirSync(dirname(url.slice('file:'.length)), { recursive: true })
  } catch {
    // A pre-existing directory (or a read-only FS) is not worth failing boot for.
  }
}

ensureParentDirectory(mastraConfig.storageUrl)

export const agentStore = new LibSQLStore({
  id: 'imno-agent-storage',
  url: mastraConfig.storageUrl,
})

/**
 * Message history only. Semantic recall would need an embedding provider, and
 * "what did we talk about yesterday?" is served by listing stored threads plus
 * the recent-message window — no vectors required.
 */
export const agentMemory = new Memory({
  storage: agentStore,
  options: {
    lastMessages: 20,
  },
})

/**
 * Thread identity.
 *
 * A thread is scoped per tenant so two tenants can never land on the same id.
 * WhatsApp threads key on the buyer's conversation, which the ingress pipeline
 * already derives from (tenant, normalized phone).
 */
export function systemThreadResource(tenantId: string, userId: string): string {
  return `system:${tenantId}:${userId}`
}

export function whatsappThreadResource(tenantId: string): string {
  return `whatsapp:${tenantId}`
}

export function whatsappThreadId(tenantId: string, conversationId: string): string {
  return `wa:${tenantId}:${conversationId}`
}
