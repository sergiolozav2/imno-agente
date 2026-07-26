import { randomUUID } from 'node:crypto'

/**
 * In-memory registry of reel render jobs.
 *
 * Rendering a minute of video takes longer than a chat turn is allowed to last,
 * so the tool that starts a job returns immediately and the result is looked up
 * on a later turn. State is per-process and deliberately not persisted: the
 * durable record of a finished reel is the `video` relation on the property, and
 * this table only exists so the assistant can say "still working" instead of
 * "I have no idea". A restart loses in-flight jobs, which on a single container
 * is the same thing that already happened to the render.
 */

export type ReelJobState = 'queued' | 'rendering' | 'ready' | 'failed'

export interface ReelJob {
  id: string
  tenantId: string
  propertyId: string
  reference: string
  state: ReelJobState
  startedAt: string
  finishedAt?: string
  /** Populated on `ready`. */
  videoUrl?: string
  imageCount?: number
  durationSeconds?: number
  /** Populated on `failed`; safe to show a user. */
  error?: string
  /**
   * Non-fatal things worth telling the operator: photos dropped for being too
   * heavy or unreachable, the gallery truncated to the image cap, a WhatsApp
   * delivery that did not go through.
   */
  notes?: string[]
  /** True when the finished reel was pushed to a buyer on WhatsApp. */
  sentToClient?: boolean
}

const jobs = new Map<string, ReelJob>()

/** Newest first, so "is it done?" finds the run the user means. */
function ordered(): ReelJob[] {
  return [...jobs.values()].sort((a, b) => b.startedAt.localeCompare(a.startedAt))
}

export function createReelJob(input: {
  tenantId: string
  propertyId: string
  reference: string
}): ReelJob {
  const job: ReelJob = {
    id: randomUUID(),
    tenantId: input.tenantId,
    propertyId: input.propertyId,
    reference: input.reference,
    state: 'queued',
    startedAt: new Date().toISOString(),
  }
  jobs.set(job.id, job)
  pruneJobs()
  return job
}

export function updateReelJob(jobId: string, patch: Partial<Omit<ReelJob, 'id'>>): void {
  const job = jobs.get(jobId)
  if (!job) return
  jobs.set(jobId, { ...job, ...patch })
}

export function findReelJob(tenantId: string, jobId: string): ReelJob | null {
  const job = jobs.get(jobId)
  return job && job.tenantId === tenantId ? job : null
}

/** Latest job for one listing, which is what "is my video ready?" means. */
export function findLatestJobForProperty(tenantId: string, propertyId: string): ReelJob | null {
  return (
    ordered().find((job) => job.tenantId === tenantId && job.propertyId === propertyId) ?? null
  )
}

export function listReelJobs(tenantId: string, limit: number): ReelJob[] {
  return ordered()
    .filter((job) => job.tenantId === tenantId)
    .slice(0, limit)
}

/** Is anything already encoding? One ffmpeg at a time on a shared half-CPU. */
export function hasActiveJob(): boolean {
  return [...jobs.values()].some((job) => job.state === 'queued' || job.state === 'rendering')
}

const MAX_TRACKED_JOBS = 50

function pruneJobs(): void {
  const all = ordered()
  for (const job of all.slice(MAX_TRACKED_JOBS)) {
    jobs.delete(job.id)
  }
}
