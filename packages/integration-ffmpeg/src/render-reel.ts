import { spawn } from 'node:child_process'
import { stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { type Result, type SafeError, ErrorCode, err, ok } from '@imno/contracts'
import { findBoldFont } from './fonts'
import { buildAssSubtitles, type SubtitleCue } from './subtitles'

/**
 * Slideshow renderer for property reels.
 *
 * One still per segment, concatenated, with an AI-written subtitle band and the
 * agency's name and phone in opposite corners. The encoder settings are chosen
 * for a half-CPU container rather than for quality: `veryfast` + `stillimage` on
 * static frames produces a few megabytes for a minute of video, which keeps it
 * both cheap to encode and small enough for WhatsApp to inline.
 *
 * Filenames referenced from inside the filtergraph are written into `workDir`
 * with fixed, boring names and the process is spawned there, so no user- or
 * model-supplied string ever has to survive filtergraph escaping.
 */

const SUBTITLE_FILE = 'subtitles.ass'
const BRAND_FILE = 'brand.txt'
const PHONE_FILE = 'phone.txt'

export interface ReelSegment {
  /** Absolute path to the already-downloaded still for this segment. */
  imagePath: string
  /** Subtitle line shown while the still is on screen. */
  text: string
  durationSeconds: number
}

export interface ReelBranding {
  businessName: string
  phone: string | null
}

export interface RenderReelInput {
  segments: ReelSegment[]
  branding: ReelBranding
  /** Absolute output path; the container is always MP4/H.264/AAC. */
  outputPath: string
  /** Scratch directory for the subtitle and text sidecars. */
  workDir: string
  width?: number
  height?: number
  fps?: number
  ffmpegPath?: string
  fontPath?: string
  timeoutMs?: number
}

export interface RenderedReel {
  path: string
  durationSeconds: number
  sizeBytes: number
}

const DEFAULTS = {
  width: 720,
  height: 1280,
  // Nothing moves between cuts, so frames beyond this buy no smoothness and
  // cost encode time we do not have.
  fps: 24,
  timeoutMs: 240_000,
}

function renderFailure(message: string): SafeError {
  return { code: ErrorCode.RenderFailure, message }
}

export async function renderPropertyReel(
  input: RenderReelInput,
): Promise<Result<RenderedReel, SafeError>> {
  if (input.segments.length === 0) {
    return err(renderFailure('un reel necesita al menos una imagen.'))
  }

  const width = input.width ?? DEFAULTS.width
  const height = input.height ?? DEFAULTS.height
  const fps = input.fps ?? DEFAULTS.fps
  const ffmpegPath = input.ffmpegPath ?? process.env.VIDEO_FFMPEG_PATH ?? 'ffmpeg'
  const totalSeconds = input.segments.reduce((sum, segment) => sum + segment.durationSeconds, 0)

  // Corner text sits below the subtitle band; lift the band clear of it.
  const marginBottom = Math.round(height * 0.14)

  const cues: SubtitleCue[] = []
  let cursor = 0
  for (const segment of input.segments) {
    cues.push({
      startSeconds: cursor,
      endSeconds: cursor + segment.durationSeconds,
      text: segment.text,
    })
    cursor += segment.durationSeconds
  }

  await writeFile(
    join(input.workDir, SUBTITLE_FILE),
    buildAssSubtitles(cues, { width, height, marginBottom }),
    'utf8',
  )
  await writeFile(join(input.workDir, BRAND_FILE), input.branding.businessName, 'utf8')
  const hasPhone = Boolean(input.branding.phone && input.branding.phone.trim().length > 0)
  if (hasPhone) {
    await writeFile(join(input.workDir, PHONE_FILE), input.branding.phone as string, 'utf8')
  }

  const fontPath = findBoldFont(input.fontPath)
  const cornerSize = Math.round(height * 0.026)
  const pad = Math.round(width * 0.05)

  const drawtext = (textFile: string, position: string) =>
    [
      'drawtext=',
      `textfile=${textFile}`,
      fontPath ? `:fontfile=${fontPath}` : '',
      `:fontsize=${cornerSize}`,
      ':fontcolor=white@0.96',
      ':borderw=3',
      ':bordercolor=black@0.55',
      `:${position}`,
    ].join('')

  const perImage = input.segments.map(
    (_, index) =>
      `[${index}:v]scale=${width}:${height}:force_original_aspect_ratio=increase,` +
      `crop=${width}:${height},setsar=1,fps=${fps},format=yuv420p[v${index}]`,
  )
  const concatInputs = input.segments.map((_, index) => `[v${index}]`).join('')

  const chain = [
    ...perImage,
    `${concatInputs}concat=n=${input.segments.length}:v=1:a=0[cat]`,
    `[cat]subtitles=${SUBTITLE_FILE}[sub]`,
    `[sub]${drawtext(BRAND_FILE, `x=${pad}:y=${pad}`)}[brand]`,
    hasPhone
      ? `[brand]${drawtext(PHONE_FILE, `x=w-tw-${pad}:y=h-th-${pad}`)}[out]`
      : '[brand]null[out]',
  ].join(';')

  const args = ['-hide_banner', '-loglevel', 'error', '-nostdin', '-y']
  for (const segment of input.segments) {
    args.push('-loop', '1', '-t', segment.durationSeconds.toFixed(3), '-i', segment.imagePath)
  }
  // A silent track: some WhatsApp clients refuse to inline a video with no
  // audio stream at all, and it costs a few kilobytes.
  args.push(
    '-f',
    'lavfi',
    '-t',
    totalSeconds.toFixed(3),
    '-i',
    'anullsrc=channel_layout=stereo:sample_rate=44100',
  )
  args.push(
    '-filter_complex',
    chain,
    '-map',
    '[out]',
    '-map',
    `${input.segments.length}:a`,
    '-c:v',
    'libx264',
    '-preset',
    'veryfast',
    '-tune',
    'stillimage',
    '-crf',
    '28',
    '-pix_fmt',
    'yuv420p',
    '-r',
    String(fps),
    '-c:a',
    'aac',
    '-b:a',
    '32k',
    '-movflags',
    '+faststart',
    '-t',
    totalSeconds.toFixed(3),
    input.outputPath,
  )

  const run = await runFfmpeg(ffmpegPath, args, input.workDir, input.timeoutMs ?? DEFAULTS.timeoutMs)
  if (!run.ok) return err(run.error)

  const stats = await stat(input.outputPath).catch(() => null)
  if (!stats || stats.size === 0) {
    return err(renderFailure('ffmpeg terminó sin escribir ningún archivo de salida.'))
  }

  return ok({ path: input.outputPath, durationSeconds: totalSeconds, sizeBytes: stats.size })
}

/**
 * ffmpeg's diagnostics are logged in full and also summarised into the returned
 * error: without them a failed render reaches the operator as "something went
 * wrong". Local paths are stripped first, since the audience is a chat message.
 */
function summariseFfmpegError(stderr: string, cwd: string): string {
  const lines = stderr
    .split('\n')
    .map((line) => line.replaceAll(cwd, '').trim())
    .filter((line) => line.length > 0)
  const last = lines.at(-1)
  return last ? last.slice(0, 300) : 'sin detalle del codificador'
}

function runFfmpeg(
  ffmpegPath: string,
  args: string[],
  cwd: string,
  timeoutMs: number,
): Promise<Result<void, SafeError>> {
  return new Promise((resolve) => {
    const child = spawn(ffmpegPath, args, { cwd, stdio: ['ignore', 'ignore', 'pipe'] })
    let stderr = ''
    let settled = false

    const finish = (result: Result<void, SafeError>) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve(result)
    }

    const timer = setTimeout(() => {
      child.kill('SIGKILL')
      finish(
        err(
          renderFailure(
            `ffmpeg no terminó en ${Math.round(timeoutMs / 1000)} s y se canceló el render.`,
          ),
        ),
      )
    }, timeoutMs)

    child.stderr?.on('data', (chunk: Buffer) => {
      stderr = `${stderr}${chunk.toString()}`.slice(-4000)
    })

    child.on('error', (error) => {
      console.error('[ffmpeg] could not be spawned', error)
      finish(
        err(
          renderFailure(
            `no se pudo ejecutar ffmpeg en "${ffmpegPath}" (${(error as NodeJS.ErrnoException).code ?? error.message}); comprueba que está instalado y que VIDEO_FFMPEG_PATH apunta al binario.`,
          ),
        ),
      )
    })

    child.on('close', (code) => {
      if (code === 0) return finish(ok(undefined))
      console.error(`[ffmpeg] exited with ${code}\n${stderr}`)
      finish(
        err(renderFailure(`ffmpeg salió con código ${code}: ${summariseFfmpegError(stderr, cwd)}`)),
      )
    })
  })
}
