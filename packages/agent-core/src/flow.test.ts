import { describe, it, expect, vi } from 'vitest'
import { ok, err, type InboundMessage } from '@imno/contracts'
import type {
  BuyerClient,
  Conversation,
  ConversationContext,
  PropertyFact,
  TenantContext,
} from '@imno/domain'
import { runAgentFlow, type AgentFlowDeps } from './flow'
import type { AgentModelService, GroundedReply } from './model-service'

const context: TenantContext = {
  tenantId: 'tenant-sunshine',
  tenantSlug: 'sunshine-realty',
  principal: { kind: 'channel', channelId: 'wa-1' },
}

const palm: PropertyFact = {
  id: 'prop-101',
  reference: '101 Palm Ave',
  title: 'Villa on 101 Palm Ave',
  zone: 'Palm District',
  price: 450000,
  currency: 'EUR',
  bedrooms: 3,
  status: 'available',
  summary: '3-bed villa in Palm District',
}

const client: BuyerClient = {
  id: 'client-1',
  tenantId: 'tenant-sunshine',
  name: 'Buyer One',
  normalizedPhone: '+34600123456',
  email: null,
  leadStatus: 'Warm',
}

function conversation(overrides: Partial<Conversation> = {}): Conversation {
  return {
    id: 'conv-1',
    tenantId: 'tenant-sunshine',
    clientId: 'client-1',
    channel: 'whatsapp',
    channelThreadId: 'thread-1',
    botPaused: false,
    ...overrides,
  }
}

function inbound(text: string): InboundMessage {
  return {
    schemaVersion: 1,
    tenantId: 'tenant-sunshine',
    channel: 'whatsapp',
    conversationId: 'conv-1',
    contact: { clientId: 'client-1', normalizedPhone: '+34600123456' },
    content: { kind: 'text', text },
    occurredAt: new Date().toISOString(),
    provider: { adapter: 'evolution', eventId: 'evt-1' },
    idempotencyKey: 'evolution:inst:evt-1',
  }
}

function makeDeps(opts: {
  facts?: PropertyFact[]
  botPaused?: boolean
  reply?: GroundedReply
  modelFails?: boolean
  leadFails?: boolean
}) {
  const ctx: ConversationContext = {
    conversation: conversation({ botPaused: opts.botPaused ?? false }),
    client,
    recentMessages: [],
  }
  const updateLeadStatus = vi.fn().mockResolvedValue(opts.leadFails ? err({ code: 'MODEL_FAILURE' }) : ok(undefined))
  const composePropertyReply = vi.fn().mockResolvedValue(
    opts.modelFails
      ? err({ code: 'MODEL_FAILURE' })
      : ok(opts.reply ?? { answer: 'Grounded answer.', citedPropertyIds: ['prop-101'], intent: 'low', confidence: 0.9 }),
  )
  const model: AgentModelService = { composePropertyReply }
  const deps: AgentFlowDeps = {
    data: {
      loadConversationContext: vi.fn().mockResolvedValue(ok(ctx)),
      searchProperties: vi.fn().mockResolvedValue(ok(opts.facts ?? [])),
      updateLeadStatus,
    },
    model,
  }
  return { deps, updateLeadStatus, composePropertyReply }
}

describe('runAgentFlow', () => {
  it('answers a listing question grounded in tenant facts', async () => {
    const { deps, composePropertyReply } = makeDeps({ facts: [palm] })
    const decision = await runAgentFlow(deps, {
      context,
      inbound: inbound('How many bedrooms does 101 Palm Ave have?'),
      language: 'en',
    })
    expect(decision.kind).toBe('reply')
    if (decision.kind === 'reply') {
      expect(decision.text).toBe('Grounded answer.')
      expect(decision.citedPropertyIds).toContain('prop-101')
      expect(decision.leadUpdatedToHot).toBe(false)
    }
    expect(composePropertyReply).toHaveBeenCalledOnce()
  })

  it('returns a clarification without inventing a listing when nothing matches', async () => {
    const { deps, composePropertyReply } = makeDeps({ facts: [] })
    const decision = await runAgentFlow(deps, {
      context,
      inbound: inbound('Do you have a castle on the moon?'),
      language: 'es',
    })
    expect(decision.kind).toBe('reply')
    if (decision.kind === 'reply') {
      expect(decision.citedPropertyIds).toEqual([])
      expect(decision.text.toLowerCase()).toContain('no encontr')
    }
    // The model is never asked to compose when there are no grounded facts.
    expect(composePropertyReply).not.toHaveBeenCalled()
  })

  it('marks the buyer Hot on the exact cash-this-week phrase, overriding model intent', async () => {
    const { deps, updateLeadStatus } = makeDeps({
      facts: [palm],
      reply: { answer: 'Great!', citedPropertyIds: ['prop-101'], intent: 'low', confidence: 0.5 },
    })
    const decision = await runAgentFlow(deps, {
      context,
      inbound: inbound('I love 101 Palm Ave. I can pay cash this week'),
      language: 'en',
    })
    expect(decision.kind).toBe('reply')
    if (decision.kind === 'reply') {
      expect(decision.intent).toBe('high')
      expect(decision.leadUpdatedToHot).toBe(true)
    }
    expect(updateLeadStatus).toHaveBeenCalledWith(
      context,
      expect.objectContaining({ clientId: 'client-1', status: 'Hot' }),
    )
  })

  it('suppresses AI output while the bot is paused (no model, no lead update)', async () => {
    const { deps, composePropertyReply, updateLeadStatus } = makeDeps({ facts: [palm], botPaused: true })
    const decision = await runAgentFlow(deps, {
      context,
      inbound: inbound('I can pay cash this week'),
    })
    expect(decision.kind).toBe('suppressed')
    expect(composePropertyReply).not.toHaveBeenCalled()
    expect(updateLeadStatus).not.toHaveBeenCalled()
  })

  it('fails (never reports success) when the model fails', async () => {
    const { deps } = makeDeps({ facts: [palm], modelFails: true })
    const decision = await runAgentFlow(deps, {
      context,
      inbound: inbound('Tell me about 101 Palm Ave'),
    })
    expect(decision.kind).toBe('failed')
  })

  it('fails when the Hot lead update fails', async () => {
    const { deps } = makeDeps({ facts: [palm], leadFails: true })
    const decision = await runAgentFlow(deps, {
      context,
      inbound: inbound('I can pay cash this week'),
    })
    expect(decision.kind).toBe('failed')
  })
})
