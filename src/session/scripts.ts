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
 * Nothing here reassures anyone that things will be fine or asks them to solve
 * anything. The guided modes (Breathe, Let go) do give instructions — but only
 * ever one at a time, always about the body, never about the thoughts. An
 * overthinking mind is juggling ten things at once; a single physical
 * instruction is the one kind of sentence that displaces them without becoming
 * another item on the list.
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
  // Breathe
  | 'restNotSleep'
  | 'orbPace'
  | 'longerOut'
  | 'bodyKnows'
  // Let go
  | 'settleIn'
  | 'softenFace'
  | 'unclenchJaw'
  | 'dropShoulders'
  | 'heavyArms'
  | 'softBelly'
  | 'heavyLegs'
  | 'heldByBed'
  | 'restIsEnough'

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

  // The orb does the talking (its in/out labels live in Breath.tsx, locked to
  // the animation). These lines only set the frame: rest, not sleep.
  breath: {
    cues: [
      { at: 12, hold: 12, key: 'restNotSleep' },
      { at: 40, hold: 12, key: 'orbPace' },
      { at: 92, hold: 12, key: 'longerOut' },
      { at: 170, hold: 13, key: 'bodyKnows' },
      { at: 300, hold: 13, key: 'itCanWait' },
    ],
    end: GOOD_NIGHT,
  },

  // A body scan, top to bottom, one part at a time — thiền buông thư. The gaps
  // widen as it goes: by the legs, most people are no longer reading.
  release: {
    cues: [
      { at: 14, hold: 13, key: 'settleIn' },
      { at: 48, hold: 13, key: 'softenFace' },
      { at: 86, hold: 13, key: 'unclenchJaw' },
      { at: 126, hold: 13, key: 'dropShoulders' },
      { at: 168, hold: 13, key: 'heavyArms' },
      { at: 214, hold: 13, key: 'softBelly' },
      { at: 262, hold: 13, key: 'heavyLegs' },
      { at: 314, hold: 14, key: 'heldByBed' },
      { at: 420, hold: 14, key: 'restIsEnough' },
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
