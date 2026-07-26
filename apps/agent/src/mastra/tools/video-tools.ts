import { createTool } from '@mastra/core/tools'
import { z } from 'zod'
import { callDataOperation } from '../data-client'
import { optionalContextValue, tenantIdFrom, type ToolExecutionContext } from '../request-context'
import {
  createReelJob,
  findLatestJobForProperty,
  findReelJob,
  hasActiveJob,
  type ReelJob,
} from '../video/reel-jobs'
import { REEL_TOTAL_SECONDS, resolveScriptLanguage, runReelPipeline } from '../video/reel-pipeline'

/**
 * Property reel generation.
 *
 * Split across two tools on purpose. Encoding a minute of video outlives the
 * request that asked for it — the API aborts an agent call at 60 seconds — so
 * `create-property-video` only enqueues and answers, and the outcome is reported
 * on a later turn through `get-property-video`. Awaiting the render inside the
 * turn would time out the whole conversation.
 */

const jobStatusShape = z.object({
  jobId: z.string(),
  propertyId: z.string(),
  reference: z.string(),
  status: z.enum(['queued', 'rendering', 'ready', 'failed']),
  videoUrl: z.string().nullable(),
  imageCount: z.number().nullable(),
  durationSeconds: z.number().nullable(),
  sentToClient: z.boolean(),
  detail: z.string().nullable(),
})

type JobStatus = z.infer<typeof jobStatusShape>

function toStatus(job: ReelJob): JobStatus {
  return {
    jobId: job.id,
    propertyId: job.propertyId,
    reference: job.reference,
    status: job.state,
    videoUrl: job.videoUrl ?? null,
    imageCount: job.imageCount ?? null,
    durationSeconds: job.durationSeconds ?? null,
    sentToClient: job.sentToClient === true,
    detail: job.error ?? null,
  }
}

interface PropertyMediaProjection {
  property: {
    id: string
    reference: string
    videoUrl: string | null
    imageUrls?: string[]
    mainImageUrl?: string | null
  }
}

export const createPropertyVideoTool = createTool({
  id: 'create-property-video',
  description: [
    `Start rendering a ${REEL_TOTAL_SECONDS}-second vertical promo video for one property,`,
    'built from its photos with an AI-written subtitle description and the agency name and phone in the corners.',
    'Rendering runs in the background and takes one to three minutes, so this returns immediately:',
    'tell the user the video is being prepared and that you will have the link shortly.',
    'Never claim the video is ready based on this tool — call get-property-video to find out.',
    'In a WhatsApp conversation the finished video is sent to the buyer automatically.',
  ].join(' '),
  inputSchema: z.object({
    propertyId: z.string().describe('Id of the property to build the reel from'),
    language: z
      .string()
      .optional()
      .describe('Language for the subtitles, defaults to the tenant default'),
  }),
  outputSchema: z.union([
    z.object({
      jobId: z.string(),
      propertyId: z.string(),
      reference: z.string(),
      status: z.literal('queued'),
      imageCount: z.number(),
      totalSeconds: z.number(),
    }),
    z.object({ error: z.string() }),
  ]),
  execute: async ({ propertyId, language }, context) => {
    const execution = context as ToolExecutionContext
    const tenantId = tenantIdFrom(execution)

    // One encode at a time: the container has half a CPU, and two concurrent
    // ffmpeg runs would make both of them miss their deadline.
    if (hasActiveJob()) {
      return { error: 'Ya hay un vídeo en proceso. Espera a que termine antes de pedir otro.' }
    }

    const loaded = await callDataOperation<PropertyMediaProjection>(tenantId, 'properties.get', {
      propertyId,
    })
    if (!loaded.ok) return { error: loaded.error }

    const { reference, imageUrls, mainImageUrl } = loaded.data.property
    const imageCount = new Set(
      [...(mainImageUrl ? [mainImageUrl] : []), ...(imageUrls ?? [])].filter(Boolean),
    ).size

    if (imageCount === 0) {
      return {
        error:
          'Esa propiedad no tiene imágenes cargadas, así que no se puede generar el vídeo. Añade al menos una foto.',
      }
    }

    const clientId = optionalContextValue(execution, 'clientId')
    const job = createReelJob({ tenantId, propertyId, reference: reference || propertyId })

    // Detached on purpose: this turn returns now and the render continues.
    void runReelPipeline({
      jobId: job.id,
      tenantId,
      propertyId,
      language: resolveScriptLanguage(language ?? optionalContextValue(execution, 'language')),
      ...(clientId ? { clientId } : {}),
    })

    return {
      jobId: job.id,
      propertyId: job.propertyId,
      reference: job.reference,
      status: 'queued' as const,
      imageCount,
      totalSeconds: REEL_TOTAL_SECONDS,
    }
  },
})

export const getPropertyVideoTool = createTool({
  id: 'get-property-video',
  description: [
    'Check whether a property video has finished rendering, and get its URL.',
    'Call this whenever the user asks about a video you started earlier, or asks whether it is ready.',
    'Identify the run by propertyId, or by jobId if you have one.',
    'When the status is ready, give the user the URL as a markdown link so it plays in the chat.',
  ].join(' '),
  inputSchema: z.object({
    propertyId: z.string().optional().describe('Property whose latest video you want'),
    jobId: z.string().optional().describe('Specific render job id'),
  }),
  outputSchema: z.union([jobStatusShape, z.object({ error: z.string() })]),
  execute: async ({ propertyId, jobId }, context) => {
    const tenantId = tenantIdFrom(context as ToolExecutionContext)

    const job = jobId
      ? findReelJob(tenantId, jobId)
      : propertyId
        ? findLatestJobForProperty(tenantId, propertyId)
        : null

    if (job) return toStatus(job)

    // No live job. A reel rendered before the last restart still hangs off the
    // listing, so fall back to the stored relation rather than denying it.
    if (propertyId) {
      const stored = await callDataOperation<PropertyMediaProjection>(tenantId, 'properties.get', {
        propertyId,
      })
      if (stored.ok && stored.data.property.videoUrl) {
        return {
          jobId: '',
          propertyId,
          reference: stored.data.property.reference,
          status: 'ready' as const,
          videoUrl: stored.data.property.videoUrl,
          imageCount: null,
          durationSeconds: null,
          sentToClient: false,
          detail: null,
        }
      }
    }

    return { error: 'No encuentro ningún vídeo para esa propiedad. Puedo generar uno si quieres.' }
  },
})

export const videoTools = { createPropertyVideoTool, getPropertyVideoTool }
