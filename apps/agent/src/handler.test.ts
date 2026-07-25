import { describe, it, expect } from 'vitest'
import { ok } from '@imno/contracts'
import type { AgentModelService, GroundedReply } from '@imno/agent-core'
import { signInternalRequest } from '@imno/runtime-config'
import { createAgentHandler } from './handler'

const secret = 'test-internal-secret'
const COMPOSE_PATH = '/internal/agent/compose-reply'

const cannedReply: GroundedReply = {
  answer: 'The apartment at 101 Palm Ave is available for 250000 USD.',
  citedPropertyIds: ['prop-1'],
  intent: 'high',
  confidence: 0.9,
}

const fakeModelService: AgentModelService = {
  async composePropertyReply() {
    return ok(cannedReply)
  },
}

function buildHandler() {
  return createAgentHandler({ secret, modelService: fakeModelService })
}

describe('agent handler', () => {
  it('serves the health probe without auth', async () => {
    const res = await buildHandler().handle({
      method: 'GET',
      path: '/health',
      headers: {},
      body: '',
    })
    expect(res.status).toBe(200)
    expect(res.json).toEqual({ status: 'ok', service: 'agent' })
  })

  it('composes a reply for a validly signed request', async () => {
    const body = JSON.stringify({
      language: 'en',
      buyerText: 'Is 101 Palm Ave still available?',
      facts: [
        {
          id: 'prop-1',
          reference: '101 Palm Ave',
          title: 'Palm Ave apartment',
          zone: 'centro',
          price: 250000,
          currency: 'USD',
          status: 'available',
          summary: 'Two-bed apartment near the park.',
        },
      ],
    })
    const parts = signInternalRequest(secret, { method: 'POST', path: COMPOSE_PATH, body })

    const res = await buildHandler().handle({
      method: 'POST',
      path: COMPOSE_PATH,
      headers: {
        'x-internal-timestamp': parts.timestamp,
        'x-internal-nonce': parts.nonce,
        'x-internal-signature': parts.signature,
      },
      body,
    })

    expect(res.status).toBe(200)
    expect(res.json).toEqual({ reply: cannedReply })
  })

  it('rejects a request with a bad signature', async () => {
    const body = JSON.stringify({ language: 'en', buyerText: 'Hola', facts: [] })
    const parts = signInternalRequest(secret, { method: 'POST', path: COMPOSE_PATH, body })

    const res = await buildHandler().handle({
      method: 'POST',
      path: COMPOSE_PATH,
      headers: {
        'x-internal-timestamp': parts.timestamp,
        'x-internal-nonce': parts.nonce,
        'x-internal-signature': 'not-a-valid-signature',
      },
      body,
    })

    expect(res.status).toBe(401)
    expect(res.json).toEqual({ error: { code: 'INTERNAL_AUTH_INVALID' } })
  })

  it('returns 404 for an unknown route', async () => {
    const res = await buildHandler().handle({
      method: 'GET',
      path: '/unknown',
      headers: {},
      body: '',
    })
    expect(res.status).toBe(404)
    expect(res.json).toEqual({ error: { code: 'RESOURCE_NOT_FOUND' } })
  })
})
