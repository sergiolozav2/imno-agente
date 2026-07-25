import { ErrorCode, err, ok } from '@imno/contracts'
import type { Result, SafeError } from '@imno/contracts'
import type {
  ModelResult,
  StructuredGenerationRequest,
  StructuredModelTransport,
} from '@imno/domain'

/**
 * Configuration for the default OpenAI-compatible (DeepSeek) transport.
 * The apiKey is used only to build the Authorization header and is never
 * echoed into any returned SafeError message.
 */
export interface ModelTransportConfig {
  apiKey: string
  model: string
  baseUrl: string
  timeoutMs?: number
}

const DEFAULT_TIMEOUT_MS = 20_000
const DEFAULT_TEMPERATURE = 0.2
const DEFAULT_MAX_TOKENS = 800

/** Builds a SafeError for any model-side failure. Never carries secrets. */
function modelFailure(message: string): SafeError {
  return { code: ErrorCode.ModelFailure, message }
}

interface ChatCompletionUsage {
  prompt_tokens?: number
  completion_tokens?: number
}

interface ChatCompletionResponse {
  choices?: Array<{ message?: { content?: unknown } }>
  usage?: ChatCompletionUsage
}

/**
 * Creates the default structured model transport backed by an OpenAI/DeepSeek
 * compatible `/chat/completions` endpoint. Uses the global `fetch` and an
 * `AbortController`-bounded timeout; no SDK dependency.
 */
export function createModelTransport(config: ModelTransportConfig): StructuredModelTransport {
  const endpoint = `${config.baseUrl.replace(/\/$/, '')}/chat/completions`
  const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS

  return {
    async generateStructured<T>(
      request: StructuredGenerationRequest<T>,
    ): Promise<Result<ModelResult<T>, SafeError>> {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), timeoutMs)

      let response: Response
      try {
        response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${config.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: config.model,
            temperature: request.temperature ?? DEFAULT_TEMPERATURE,
            max_tokens: request.maxTokens ?? DEFAULT_MAX_TOKENS,
            response_format: { type: 'json_object' },
            messages: [
              { role: 'system', content: request.system },
              { role: 'user', content: request.user },
            ],
          }),
          signal: controller.signal,
        })
      } catch {
        // Network error or timeout/abort. Do not leak the endpoint or apiKey.
        return err(modelFailure('Model request failed to complete.'))
      } finally {
        clearTimeout(timer)
      }

      if (!response.ok) {
        return err(modelFailure(`Model responded with status ${response.status}.`))
      }

      let body: ChatCompletionResponse
      try {
        body = (await response.json()) as ChatCompletionResponse
      } catch {
        return err(modelFailure('Model response body was not valid JSON.'))
      }

      const content = body.choices?.[0]?.message?.content
      if (typeof content !== 'string') {
        return err(modelFailure('Model response did not include structured content.'))
      }

      let parsed: unknown
      try {
        parsed = JSON.parse(content)
      } catch {
        return err(modelFailure('Model structured content was not valid JSON.'))
      }

      const validated = request.validate(parsed)
      if (!validated.ok) {
        return validated
      }

      const usage = body.usage
      return ok({
        value: validated.value,
        usage: {
          promptTokens: usage?.prompt_tokens,
          completionTokens: usage?.completion_tokens,
        },
      })
    },
  }
}
