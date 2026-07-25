import { afterEach, describe, expect, it, vi } from 'vitest'
import { ErrorCode, err, ok } from '@imno/contracts'
import type { Result, SafeError } from '@imno/contracts'
import { createModelTransport } from './transport'

interface Answer {
  answer: string
}

/** Simple validator: succeeds when `raw` has a string `answer`. */
function validateAnswer(raw: unknown): Result<Answer, SafeError> {
  if (
    typeof raw === 'object' &&
    raw !== null &&
    typeof (raw as { answer?: unknown }).answer === 'string'
  ) {
    return ok({ answer: (raw as { answer: string }).answer })
  }
  return err({ code: ErrorCode.ValidationFailed, message: 'missing answer' })
}

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
  vi.restoreAllMocks()
})

const config = {
  apiKey: 'secret-key',
  model: 'deepseek-chat',
  baseUrl: 'https://api.deepseek.com/v1',
}

describe('createModelTransport', () => {
  it('returns ok with parsed value and usage on success', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: JSON.stringify({ answer: 'hi' }) } }],
        usage: { prompt_tokens: 1, completion_tokens: 2 },
      }),
    }) as unknown as typeof fetch

    const transport = createModelTransport(config)
    const result = await transport.generateStructured({
      system: 'sys',
      user: 'usr',
      validate: validateAnswer,
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.value).toEqual({ answer: 'hi' })
      expect(result.value.usage).toEqual({ promptTokens: 1, completionTokens: 2 })
    }
  })

  it('returns MODEL_FAILURE when fetch rejects', async () => {
    globalThis.fetch = vi
      .fn()
      .mockRejectedValue(new Error('network down')) as unknown as typeof fetch

    const transport = createModelTransport(config)
    const result = await transport.generateStructured({
      system: 'sys',
      user: 'usr',
      validate: validateAnswer,
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe(ErrorCode.ModelFailure)
      expect(result.error.message ?? '').not.toContain(config.apiKey)
    }
  })

  it('returns MODEL_FAILURE when content is not valid JSON', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: 'not-json{' } }],
        usage: { prompt_tokens: 1, completion_tokens: 2 },
      }),
    }) as unknown as typeof fetch

    const transport = createModelTransport(config)
    const result = await transport.generateStructured({
      system: 'sys',
      user: 'usr',
      validate: validateAnswer,
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe(ErrorCode.ModelFailure)
    }
  })
})
