/**
 * The reel renderer's hard limits, in one place.
 *
 * These are quoted back to the user when a render fails or when they ask what
 * the video feature can take, so they live as data rather than as prose spread
 * across tool descriptions and error strings.
 */

/** Total runtime of every reel, regardless of how many stills it has. */
export const REEL_TOTAL_SECONDS = 61

/**
 * Beyond this the per-image slot gets too short to read a subtitle in, so extra
 * photos are dropped rather than flashed past.
 */
export const MAX_IMAGES = 8

export const MAX_IMAGE_BYTES = 12 * 1024 * 1024

/** Payload's upload ceiling for the finished MP4, enforced on the API side. */
export const MAX_VIDEO_BYTES = 24 * 1024 * 1024

export const REEL_LIMITS = {
  minImages: 1,
  maxImages: MAX_IMAGES,
  maxImageMb: MAX_IMAGE_BYTES / (1024 * 1024),
  /** Anything ffmpeg can decode; the extension on the stored asset is ignored. */
  imageFormats: ['jpeg', 'png', 'webp', 'gif', 'bmp', 'tiff'],
  totalSeconds: REEL_TOTAL_SECONDS,
  output: { width: 720, height: 1280, aspectRatio: '9:16', container: 'mp4', codec: 'h264' },
  maxVideoMb: MAX_VIDEO_BYTES / (1024 * 1024),
  typicalRenderSeconds: [60, 180] as const,
  /** Only one encode at a time: the container runs on half a CPU. */
  concurrentRenders: 1,
} as const

/** One-line, user-facing summary of what the renderer accepts. */
export function describeReelLimits(): string {
  return [
    `Formatos de imagen: ${REEL_LIMITS.imageFormats.join(', ')} (cualquier imagen que decodifique ffmpeg; no hace falta PNG).`,
    `Fotos: entre ${REEL_LIMITS.minImages} y ${REEL_LIMITS.maxImages} por vídeo, máximo ${REEL_LIMITS.maxImageMb} MB cada una; las fotos de más se descartan.`,
    `Las fotos tienen que ser descargables por el runtime desde la URL guardada en la propiedad.`,
    `Salida: MP4 H.264 vertical ${REEL_LIMITS.output.width}x${REEL_LIMITS.output.height} (${REEL_LIMITS.output.aspectRatio}) de ${REEL_LIMITS.totalSeconds} s, máximo ${REEL_LIMITS.maxVideoMb} MB.`,
    `Un solo vídeo a la vez, y tarda entre ${REEL_LIMITS.typicalRenderSeconds[0]} y ${REEL_LIMITS.typicalRenderSeconds[1]} segundos.`,
  ].join(' ')
}
