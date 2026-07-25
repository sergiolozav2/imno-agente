/**
 * Shared content + media value types used by content-core (use cases) and the
 * FFmpeg/deferred-media adapters. Kept in contracts so both sides depend on one
 * neutral definition rather than importing each other.
 */

export interface SocialCopy {
  title: string
  description: string
  caption: string
  hashtags: string[]
  language: string
  sourcePropertyId: string
}

export type AspectRatio = '9:16' | '1:1' | '16:9'

export interface VideoOverlay {
  text: string
  startMs: number
  endMs: number
}

export interface VideoRenderImage {
  assetId: string
  localPath: string
}

export interface VideoRenderInput {
  tenantId: string
  propertyId: string
  imageFiles: VideoRenderImage[]
  musicFile: { assetId?: string; localPath: string }
  overlays: VideoOverlay[]
  aspectRatio: AspectRatio
  outputFormat: 'mp4'
  outputPath: string
}

export interface RenderedFile {
  localPath: string
  mimeType: string
  durationSeconds: number
  width: number
  height: number
}

/** Deferred media provider results (not implemented for the MVP). */
export interface TranscriptionResult {
  status: 'unsupported'
}
export interface VoiceResult {
  status: 'unsupported'
}
export interface ImageEnhancementResult {
  status: 'pass-through'
  assetId: string
  enhanced: false
}
