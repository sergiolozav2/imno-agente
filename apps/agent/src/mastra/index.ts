import { Mastra } from '@mastra/core'
import { clientAgent } from './agents/client-agent'
import { socialCopyAgent } from './agents/social-copy-agent'
import { systemAgent } from './agents/system-agent'
import { agentStore } from './storage'
import { socialContentWorkflow } from './workflows/social-content-workflow'

/**
 * Mastra entry point for the agent runtime.
 *
 * Registering primitives here (rather than importing them ad hoc) gives them the
 * shared store, logger, and registry, and makes them visible to Mastra Studio and
 * the `mastra api` CLI — which is how you inspect a stuck run without adding
 * throwaway scripts.
 */
export const mastra = new Mastra({
  agents: { systemAgent, clientAgent, socialCopyAgent },
  workflows: { socialContentWorkflow },
  storage: agentStore,
})

export { systemAgent, clientAgent, socialCopyAgent, socialContentWorkflow }
