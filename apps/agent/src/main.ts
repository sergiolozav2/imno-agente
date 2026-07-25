// The runtime serves two endpoint families:
//   - `/internal/agent/compose-reply` is a bounded, single-shot model call driven
//     by the deterministic flow in apps/api.
//   - the Mastra endpoints (`system-chat`, `client-reply`, `sessions`) host the
//     tool-using agents defined under `src/mastra`.
// Mastra primitives are registered in `src/mastra/index.ts`, so `mastra dev`
// can also open Studio against this same project.
import { createAgentModelService } from '@imno/agent-core'
import { createModelTransport } from '@imno/integration-llm'
import { loadAgentConfig } from '@imno/runtime-config'
import { createAgentHandler } from './handler'
import { startServer } from './server'

/**
 * Composition root for the private agent runtime. It holds the LLM key and
 * exposes one HMAC-authenticated internal endpoint. On invalid config it prints
 * only the offending variable NAME (never its value) and exits non-zero.
 */
const configResult = loadAgentConfig()
if (!configResult.ok) {
  console.error(`CONFIG_INVALID ${configResult.error.variable}`)
  process.exit(1)
}

const cfg = configResult.value

const transport = createModelTransport({
  apiKey: cfg.llmApiKey,
  model: cfg.llmModel,
  baseUrl: cfg.llmBaseUrl,
})
const modelService = createAgentModelService(transport)
const handler = createAgentHandler({ secret: cfg.internalServiceSecret, modelService })

// A managed host assigns the port through PORT; locally it comes from the URL
// the API is configured to call.
const port = Number(process.env.PORT) || Number(new URL(cfg.agentInternalUrl).port) || 3002
startServer(port, handler)
console.log(`agent runtime listening on :${port}`)
console.log(
  'endpoints: /health, /internal/agent/compose-reply, /internal/agent/system-chat, /internal/agent/client-reply, /internal/agent/sessions',
)
