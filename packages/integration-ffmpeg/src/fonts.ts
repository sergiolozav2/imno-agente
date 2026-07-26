import { existsSync } from 'node:fs'

/**
 * Font discovery for burned-in text.
 *
 * The agent image is Debian slim, which ships no fonts at all: without an
 * explicit file `drawtext` fails outright and libass silently renders nothing.
 * The Dockerfile installs `fonts-dejavu-core`, and these are the paths that
 * package lands on across Debian and Ubuntu hosts.
 */

const REGULAR_CANDIDATES = [
  '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
  '/usr/share/fonts/TTF/DejaVuSans.ttf',
  '/System/Library/Fonts/Supplemental/Arial.ttf',
]

const BOLD_CANDIDATES = [
  '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
  '/usr/share/fonts/TTF/DejaVuSans-Bold.ttf',
  '/System/Library/Fonts/Supplemental/Arial Bold.ttf',
]

function firstExisting(candidates: string[]): string | null {
  return candidates.find((path) => existsSync(path)) ?? null
}

/** Absolute path to a bold sans face, or null to let fontconfig decide. */
export function findBoldFont(override?: string): string | null {
  if (override && existsSync(override)) return override
  return firstExisting(BOLD_CANDIDATES) ?? firstExisting(REGULAR_CANDIDATES)
}

/** Family name libass should ask fontconfig for. */
export const SUBTITLE_FONT_FAMILY = 'DejaVu Sans'
