import type { Mode } from '../types'

/**
 * When the words appear, as data. The words themselves live in src/i18n.ts —
 * this file only knows their keys, so the timeline is identical in every
 * language.
 *
 * `hold` is the full on-screen life of a line including its 2.6s fade in and
 * out, so anything under ~9s barely registers. Windows never overlap: a gap of
 * pure darkness between lines is what keeps it from feeling like a slideshow.
 *
 * Nothing here reassures anyone that things will be fine or asks them to do
 * anything. The only claim being made is that tonight is not when it gets solved.
 */
export type CueKey =
  | 'noFiguringOut'
  | 'letSoundFill'
  | 'breatheSlower'
  | 'nothingToSolve'
  | 'itCanWait'
  | 'justRain'
  | 'breatheIn'
  | 'breatheOut'
  | 'notTonight'
  | 'stillHere'
  | 'goodNight'

export type Cue = { at: number; hold: number; key: CueKey }

/** Positioned from the end of the session rather than the start. */
export type EndCue = { before: number; hold: number; key: CueKey }

export type Script = { cues: Cue[]; end?: EndCue }

const GOOD_NIGHT: EndCue = { before: 26, hold: 26, key: 'goodNight' }

export const SCRIPTS: Record<Mode, Script> = {
  // Guided, but only just. After six minutes it stops talking for good.
  calm: {
    cues: [
      { at: 20, hold: 13, key: 'noFiguringOut' },
      { at: 62, hold: 12, key: 'letSoundFill' },
      { at: 104, hold: 13, key: 'breatheSlower' },
      { at: 180, hold: 13, key: 'nothingToSolve' },
      { at: 300, hold: 13, key: 'itCanWait' },
    ],
    end: GOOD_NIGHT,
  },

  // One line, then it leaves you alone with the rain.
  rain: {
    cues: [{ at: 30, hold: 12, key: 'justRain' }],
    end: GOOD_NIGHT,
  },

  // No sound, no orb, and long stretches of nothing at all. The emptiness is
  // the feature — do not fill it.
  empty: {
    cues: [
      { at: 3, hold: 10, key: 'breatheIn' },
      { at: 15, hold: 10, key: 'breatheOut' },
      { at: 33, hold: 14, key: 'notTonight' },
      { at: 240, hold: 14, key: 'stillHere' },
    ],
    end: GOOD_NIGHT,
  },
}

/** The line to show at `elapsed` seconds, or null for silence. */
export function cueAt(mode: Mode, elapsed: number, total: number | null): CueKey | null {
  const script = SCRIPTS[mode]

  if (script.end && total !== null) {
    const from = total - script.end.before
    if (elapsed >= from && elapsed < from + script.end.hold) return script.end.key
  }
  for (const c of script.cues) {
    if (elapsed >= c.at && elapsed < c.at + c.hold) return c.key
  }
  return null
}
