import { type SafeError, type InboundMessage } from '@imno/contracts'
import {
  type DataGateway,
  type TenantContext,
  classifyHighIntentDeterministic,
} from '@imno/domain'
import { type AgentModelService, type IntentLevel } from './model-service'
import { extractPropertyQuery } from './query-extraction'
import { noMatchReply } from './copy'

/**
 * The outcome of the deterministic agent workflow. The flow reads context,
 * grounds a reply, and applies the idempotent Hot lead update — but it does NOT
 * persist the outbound message or deliver it; the processing coordinator does
 * that from this decision.
 */
export type AgentDecision =
  | { kind: 'suppressed' }
  | {
      kind: 'reply'
      text: string
      citedPropertyIds: string[]
      intent: IntentLevel
      leadUpdatedToHot: boolean
    }
  | { kind: 'failed'; error: SafeError }

export interface AgentFlowDeps {
  data: Pick<DataGateway, 'loadConversationContext' | 'searchProperties' | 'updateLeadStatus'>
  model: AgentModelService
}

export interface AgentFlowInput {
  context: TenantContext
  inbound: InboundMessage
  language?: string
}

/**
 * Deterministic workflow:
 *   load context -> pause check -> extract query -> search tenant properties
 *   -> ground reply (or clarify) -> high-intent -> idempotent Hot update.
 * Every property read is tenant-scoped through the injected gateway.
 */
export async function runAgentFlow(
  deps: AgentFlowDeps,
  input: AgentFlowInput,
): Promise<AgentDecision> {
  const { context, inbound } = input
  const language = input.language ?? 'es'
  const text = inbound.content.text

  const contextResult = await deps.data.loadConversationContext(context, inbound.conversationId)
  if (!contextResult.ok) {
    return { kind: 'failed', error: contextResult.error }
  }
  const { conversation, client } = contextResult.value

  // Defense-in-depth pause check (the API service also checks before invoking).
  if (conversation.botPaused) {
    return { kind: 'suppressed' }
  }

  const query = extractPropertyQuery(text)
  const factsResult = await deps.data.searchProperties(context, query)
  if (!factsResult.ok) {
    return { kind: 'failed', error: factsResult.error }
  }
  const facts = factsResult.value

  const deterministicHigh = classifyHighIntentDeterministic(text)

  let replyText: string
  let citedPropertyIds: string[] = []
  let modelIntent: IntentLevel = 'low'

  if (facts.length === 0) {
    // No match: clarify instead of inventing a listing.
    replyText = noMatchReply(language)
  } else {
    const composed = await deps.model.composePropertyReply({
      language,
      buyerText: text,
      facts,
      conversationSummary: summarizeRecent(contextResult.value.recentMessages),
    })
    if (!composed.ok) {
      return { kind: 'failed', error: composed.error }
    }
    replyText = composed.value.answer
    citedPropertyIds = composed.value.citedPropertyIds
    modelIntent = composed.value.intent
  }

  // Deterministic High must never be downgraded by the model.
  const intent: IntentLevel = deterministicHigh ? 'high' : modelIntent

  let leadUpdatedToHot = false
  if (intent === 'high') {
    const update = await deps.data.updateLeadStatus(context, {
      clientId: client.id,
      status: 'Hot',
      reason: `high-intent inbound:${inbound.idempotencyKey}`,
    })
    if (!update.ok) {
      // A failed lead update must fail processing — never silently report success.
      return { kind: 'failed', error: update.error }
    }
    leadUpdatedToHot = true
  }

  return { kind: 'reply', text: replyText, citedPropertyIds, intent, leadUpdatedToHot }
}

function summarizeRecent(messages: { author: string; text: string }[]): string | undefined {
  if (messages.length === 0) return undefined
  return messages
    .slice(-4)
    .map((m) => `${m.author}: ${m.text}`)
    .join('\n')
}
