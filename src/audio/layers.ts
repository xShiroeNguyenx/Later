import type { SoundId } from '../types'

/**
 * Every asset URL goes through this. GitHub Pages serves a project site from
 * /<repo>/, so a hardcoded "/audio/…" would 404 there. Ends with a slash.
 * The inline script in index.html uses Vite's %BASE_URL% for the same reason.
 */
const BASE = import.meta.env.BASE_URL

/** Must match LOOP in scripts/gen-audio.mjs. */
export const LOOP_SECONDS = 48

/**
 * Half-width of the authored lull at the loop seam (SEAM_WIDTH in
 * scripts/gen-audio.mjs). Playback is started and stopped inside this window,
 * which is the only fade available on iOS — see engine.ts.
 */
export const SEAM_HALF = 1.6

export type TextureSpec = {
  /** Sparse droplets on top of the bed — the anti-repetition layer. */
  drops?: { rate: number; fMin: number; fMax: number; q: number; decayMs: [number, number]; gain: number }
  /** A whisper of high-band noise so the top end is never static. */
  shimmer?: { hp: number; lp: number; gain: number }
  /** Single crickets, wandering out of step with the ones baked into the bed. */
  chirps?: { rate: number; freq: number; gain: number }
  /** Far-apart single notes over the pad — a music box heard from another room. */
  tones?: { rate: number; notes: number[]; gain: number }
  /** Distant thunder, from file. */
  thunder?: { gap: [number, number]; gain: number }
}

export type Bed = { file: string; texture: TextureSpec }

export const BEDS: Record<Exclude<SoundId, 'none'>, Bed> = {
  rain: {
    file: `${BASE}audio/rain-base.m4a`,
    texture: {
      drops: { rate: 5, fMin: 1400, fMax: 5600, q: 6, decayMs: [7, 26], gain: 0.09 },
      shimmer: { hp: 4000, lp: 9000, gain: 0.02 },
      thunder: { gap: [55, 130], gain: 0.5 },
    },
  },
  window: {
    file: `${BASE}audio/window-rain.m4a`,
    texture: {
      drops: { rate: 1.4, fMin: 700, fMax: 1800, q: 13, decayMs: [55, 140], gain: 0.08 },
      thunder: { gap: [45, 110], gain: 0.62 },
    },
  },
  night: {
    file: `${BASE}audio/night-ambience.m4a`,
    texture: {
      chirps: { rate: 0.42, freq: 4550, gain: 0.035 },
      shimmer: { hp: 5000, lp: 10000, gain: 0.012 },
    },
  },
  drift: {
    file: `${BASE}audio/drift.m4a`,
    texture: {
      // A-minor pentatonic, an octave-and-more above the pad, ~7–19s apart.
      tones: { rate: 0.09, notes: [440, 523.25, 587.33, 659.25, 783.99], gain: 0.05 },
      shimmer: { hp: 4500, lp: 9500, gain: 0.008 },
    },
  },
}

export const THUNDER_FILES = [`${BASE}audio/thunder-1.m4a`, `${BASE}audio/thunder-2.m4a`]

export const ICONS = [
  { src: `${BASE}icons/icon-192.png`, sizes: '192x192', type: 'image/png' },
  { src: `${BASE}icons/icon-512.png`, sizes: '512x512', type: 'image/png' },
]

export const bedFor = (s: SoundId): Bed | null => (s === 'none' ? null : BEDS[s])
