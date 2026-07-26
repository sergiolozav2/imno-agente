import { SUBTITLE_FONT_FAMILY } from './fonts'

/**
 * Subtitle track generation, as ASS rather than drawtext.
 *
 * Burning Spanish sentences in with `drawtext` means escaping colons, commas,
 * quotes and backslashes inside a filtergraph that uses those same characters as
 * syntax, and it offers no line wrapping. libass takes the text from a file and
 * wraps it itself, so a long sentence with accents and punctuation just works.
 */

export interface SubtitleCue {
  startSeconds: number
  endSeconds: number
  text: string
}

export interface SubtitleStyleOptions {
  width: number
  height: number
  /** Distance from the bottom edge, leaving room for the corner branding. */
  marginBottom: number
}

/** ASS wants H:MM:SS.cc with exactly two decimals. */
function timestamp(totalSeconds: number): string {
  const clamped = Math.max(0, totalSeconds)
  const hours = Math.floor(clamped / 3600)
  const minutes = Math.floor((clamped % 3600) / 60)
  const seconds = Math.floor(clamped % 60)
  const centis = Math.round((clamped - Math.floor(clamped)) * 100)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${hours}:${pad(minutes)}:${pad(seconds)}.${pad(Math.min(centis, 99))}`
}

/**
 * Braces open an override block in ASS and a literal newline would end the
 * event early, so both are neutralised. Everything else — commas included — is
 * safe because Text is the final, unsplit field of the line.
 */
function escapeCue(text: string): string {
  return text
    .replace(/[{}]/g, '')
    .replace(/\r?\n+/g, ' \\N ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function buildAssSubtitles(cues: SubtitleCue[], style: SubtitleStyleOptions): string {
  // Scale with the canvas so the same numbers work at 720p and 1080p.
  const fontSize = Math.round(style.height * 0.036)

  const header = [
    '[Script Info]',
    'ScriptType: v4.00+',
    `PlayResX: ${style.width}`,
    `PlayResY: ${style.height}`,
    // Smart wrapping, balancing line lengths rather than filling greedily.
    'WrapStyle: 0',
    'ScaledBorderAndShadow: yes',
    '',
    '[V4+ Styles]',
    'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour,' +
      ' BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle,' +
      ' BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
    // BorderStyle 3 boxes each line, and libass paints that box in
    // OutlineColour — so the alpha that matters is there, not in BackColour.
    // &H66 leaves the photo faintly visible while keeping the text readable
    // over both bright and dark images.
    [
      'Style: Sub',
      SUBTITLE_FONT_FAMILY,
      String(fontSize),
      '&H00FFFFFF',
      '&H000000FF',
      '&H66000000',
      '&H66000000',
      '-1',
      '0',
      '0',
      '0',
      '100',
      '100',
      '0',
      '0',
      '3',
      '8',
      '0',
      '2',
      String(Math.round(style.width * 0.08)),
      String(Math.round(style.width * 0.08)),
      String(style.marginBottom),
      '1',
    ].join(','),
    '',
    '[Events]',
    'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
  ]

  const events = cues
    .map((cue) => escapeCue(cue.text).length > 0 ? cue : null)
    .filter((cue): cue is SubtitleCue => cue !== null)
    .map(
      (cue) =>
        `Dialogue: 0,${timestamp(cue.startSeconds)},${timestamp(cue.endSeconds)},Sub,,0,0,0,,${escapeCue(cue.text)}`,
    )

  return [...header, ...events, ''].join('\n')
}
