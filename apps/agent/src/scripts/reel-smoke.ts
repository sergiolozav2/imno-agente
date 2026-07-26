/**
 * Scratch harness: runs the reel pipeline end to end against the local stack so
 * failures show up as real job state instead of a chat message.
 *
 *   pnpm reel:smoke <tenantId> <propertyId>
 */
import { createReelJob, findReelJob } from '../mastra/video/reel-jobs'
import { runReelPipeline } from '../mastra/video/reel-pipeline'

const [tenantId, propertyId] = process.argv.slice(2)
if (!tenantId || !propertyId) {
  console.error('usage: reel-smoke <tenantId> <propertyId>')
  process.exit(1)
}

const job = createReelJob({ tenantId, propertyId, reference: propertyId })
await runReelPipeline({ jobId: job.id, tenantId, propertyId, language: 'es' })
console.log(JSON.stringify(findReelJob(tenantId, job.id), null, 2))
