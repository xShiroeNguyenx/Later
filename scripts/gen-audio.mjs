/**
 * Generates every audio asset in public/audio from scratch.
 *
 * Nothing is sampled or downloaded — the beds are synthesised here, so there is
 * no licence to track and the loops are mathematically seamless (see loopSafe
 * in dsp.mjs). Output is mono AAC in .m4a: the one codec/container combination
 * iOS Safari will keep playing with the screen locked.
 *
 *   npm run audio
 */
import { spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync, statSync, rmSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import ffmpeg from 'ffmpeg-static'
import {
  SR, rng, whiteNoise, tile, lowpass, highpass, bandpass, peaking,
  mixInto, scale, shape, normalise, peak, addWrapped, periodicLfo,
  seamDip, fadeEdges, toWav,
} from './dsp.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'public', 'audio')
const TMP = join(ROOT, 'node_modules', '.audio-tmp')

/** Loop length. 48s keeps loop points rare and divides the cricket periods. */
const LOOP = 48
const L = LOOP * SR

/**
 * The authored lull at the loop seam (see seamDip in dsp.mjs). The app starts
 * and stops playback inside this dip, which is how fading works on iPhone
 * where HTMLMediaElement.volume is read-only.
 */
const SEAM_DEPTH = 0.55
const SEAM_WIDTH = 3.0

// ── event synthesis ──────────────────────────────────────────────────────────

/** One rain droplet / glass tap: short noise burst, band-limited, exp decay. */
function droplet(rand, { fMin, fMax, q, decayMin, decayMax, burstMs = 4 }) {
  const decayMs = decayMin + rand() * (decayMax - decayMin)
  const n = Math.ceil(((decayMs * 4) / 1000) * SR)
  const buf = new Float32Array(n)
  const burst = Math.ceil((burstMs / 1000) * SR)
  for (let i = 0; i < burst; i++) buf[i] = rand() * 2 - 1
  bandpass(buf, fMin + rand() * (fMax - fMin), q)
  const tau = (decayMs / 1000) * SR
  for (let i = 0; i < n; i++) buf[i] *= Math.exp(-i / tau)
  const p = peak(buf)
  if (p > 1e-9) scale(buf, 1 / p)
  return buf
}

/** A cricket chirp: a handful of short pulses of a near-sine tone. */
function chirp(rand, freq) {
  const pulses = 3 + Math.floor(rand() * 2)
  const pulseMs = 14 + rand() * 6
  const gapMs = 34 + rand() * 14
  const pn = Math.ceil((pulseMs / 1000) * SR)
  const gn = Math.ceil((gapMs / 1000) * SR)
  const buf = new Float32Array(pulses * (pn + gn))
  for (let p = 0; p < pulses; p++) {
    const off = p * (pn + gn)
    for (let i = 0; i < pn; i++) {
      const env = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / pn) // raised cosine
      const t = (off + i) / SR
      buf[off + i] = Math.sin(2 * Math.PI * freq * t) * env
    }
  }
  return buf
}

/** Builds one exactly-periodic layer of wrapped events. */
function eventLayer(n, count, rand, make, gainMin, gainMax) {
  const layer = new Float32Array(n)
  for (let i = 0; i < count; i++) {
    const pos = Math.floor(rand() * n)
    addWrapped(layer, make(), pos, gainMin + rand() * (gainMax - gainMin))
  }
  return layer
}

/** Filtered noise bed that loops perfectly: tile one period, filter, keep last. */
function noiseBed(seed, chain) {
  const rand = rng(seed)
  const period = whiteNoise(L, rand)
  const long = tile(period, 3)
  chain(long)
  return long.slice(2 * L)
}

// ── the four soundscapes ─────────────────────────────────────────────────────

function rainBase() {
  const hiss = noiseBed(0x1a2b, (b) => {
    highpass(b, 200)
    lowpass(b, 7000)
    lowpass(b, 7000)
    peaking(b, 2400, 0.8, 3)
  })
  const rumble = noiseBed(0x3c4d, (b) => {
    lowpass(b, 200); lowpass(b, 200); lowpass(b, 200)
  })

  // Gusts. The dominant LFO is phase-shifted so the loop seam lands in a
  // natural lull rather than mid-downpour.
  const g1 = periodicLfo(L, 2, -0.25)
  const g2 = periodicLfo(L, 3, -0.25)
  const g3 = periodicLfo(L, 5, 0.13)
  const bed = new Float32Array(L)
  mixInto(bed, hiss, 1)
  mixInto(bed, rumble, 2.2)
  shape(bed, (_, i) => 1 + 0.18 * (0.55 * g1[i] + 0.28 * g2[i] + 0.17 * g3[i]))

  const rand = rng(0x5e6f)
  const drops = eventLayer(L, Math.round(26 * LOOP), rand,
    () => droplet(rand, { fMin: 1200, fMax: 5200, q: 5, decayMin: 6, decayMax: 22 }),
    0.10, 0.30)
  mixInto(bed, drops, 1)

  seamDip(bed, SEAM_DEPTH, SEAM_WIDTH)
  return normalise(bed, 0.115)
}

function windowRain() {
  // Heard through glass: almost everything above ~1.5k is gone.
  const muffled = noiseBed(0x7a8b, (b) => {
    highpass(b, 100)
    lowpass(b, 1500); lowpass(b, 1500); lowpass(b, 1500)
  })
  const outside = noiseBed(0x9c0d, (b) => {
    highpass(b, 1500); lowpass(b, 4000)
  })
  const rumble = noiseBed(0xb1e2, (b) => {
    lowpass(b, 140); lowpass(b, 140); lowpass(b, 140)
  })

  const g1 = periodicLfo(L, 1, -0.25)
  const g2 = periodicLfo(L, 2, -0.25)
  const g3 = periodicLfo(L, 4, 0.21)
  const bed = new Float32Array(L)
  mixInto(bed, muffled, 1)
  mixInto(bed, outside, 0.09)
  mixInto(bed, rumble, 2.6)
  shape(bed, (_, i) => 1 + 0.28 * (0.5 * g1[i] + 0.3 * g2[i] + 0.2 * g3[i]))

  // Droplets hitting glass ring rather than splash — high Q, longer decay.
  const rand = rng(0xd3f4)
  const taps = eventLayer(L, Math.round(2.4 * LOOP), rand,
    () => droplet(rand, { fMin: 700, fMax: 1700, q: 12, decayMin: 50, decayMax: 130, burstMs: 2 }),
    0.06, 0.20)
  mixInto(bed, taps, 1)

  seamDip(bed, SEAM_DEPTH, SEAM_WIDTH)
  return normalise(bed, 0.105)
}

function nightAmbience() {
  const rumble = noiseBed(0x2f30, (b) => {
    lowpass(b, 110); lowpass(b, 110); lowpass(b, 110)
  })
  const air = noiseBed(0x4152, (b) => {
    highpass(b, 1800); lowpass(b, 8000)
  })

  const bed = new Float32Array(L)
  mixInto(bed, rumble, 3.0)
  mixInto(bed, air, 0.05)
  const g = periodicLfo(L, 2, -0.25)
  shape(bed, (_, i) => 1 + 0.1 * g[i])

  // Three crickets on periods that divide 48s exactly, each jittered. Wrapping
  // keeps the layer periodic no matter how much the timing wanders.
  const rand = rng(0x6374)
  for (const [periodS, freq, gain] of [[2.0, 4400, 0.045], [2.4, 4650, 0.035], [3.0, 4850, 0.028]]) {
    const count = LOOP / periodS
    for (let k = 0; k < count; k++) {
      const jitter = (rand() - 0.5) * periodS * 0.35
      const pos = Math.floor(((k * periodS + jitter + LOOP) % LOOP) * SR)
      addWrapped(bed, chirp(rand, freq * (0.99 + rand() * 0.02)), pos, gain * (0.7 + rand() * 0.6))
    }
  }

  seamDip(bed, SEAM_DEPTH, SEAM_WIDTH)
  return normalise(bed, 0.075)
}

/**
 * Soft music: a warm pad of two chords a half-loop crossfade apart — Am7 at the
 * seam, Fmaj7 mid-loop. They share three tones (A, C, E), so the change reads
 * as light shifting rather than a progression to follow; following is the
 * opposite of what this app is for.
 *
 * Every partial is quantised to a whole number of cycles per loop, so the
 * tonal layer is exactly periodic by construction and the seam cannot click.
 * The sparse melodic notes live in the Web Audio texture layer (see
 * src/audio/layers.ts), where they can be random forever instead of repeating
 * every 48 seconds.
 */
function softChords() {
  const rand = rng(0xc0de)
  const quant = (f) => Math.max(1, Math.round(f * LOOP)) / LOOP

  // [freq, gain]: A2 E3 G3 C4, then F2 C3 E3 A3.
  const CHORDS = [
    [[110.0, 1], [164.81, 0.8], [196.0, 0.62], [261.63, 0.4]],
    [[87.31, 1], [130.81, 0.8], [164.81, 0.62], [220.0, 0.42]],
  ]

  const tonal = new Float32Array(L)
  CHORDS.forEach((chord, ci) => {
    for (const [f0, g0] of chord) {
      // Each note: a detuned pair for width, plus quiet 2nd and 3rd harmonics
      // so the lowpass below leaves some warmth rather than a pure-sine organ.
      for (const [mult, mix] of [[0.9985, 0.5], [1.0015, 0.5], [2, 0.22], [3, 0.05]]) {
        const f = quant(f0 * mult)
        const phase = rand() * 2 * Math.PI
        // A slow whole-cycle amplitude wobble so no voice ever sits still.
        const wobCycles = 1 + Math.floor(rand() * 3)
        const wobPhase = rand() * 2 * Math.PI
        const wobDepth = 0.15 + rand() * 0.2
        const w = (2 * Math.PI * f) / SR
        for (let i = 0; i < L; i++) {
          const x = i / L
          // Chord A full at the seam, chord B full mid-loop — both periodic.
          const fade = 0.5 + (ci === 0 ? 0.5 : -0.5) * Math.cos(2 * Math.PI * x)
          const wob = 1 + wobDepth * Math.sin(2 * Math.PI * wobCycles * x + wobPhase)
          tonal[i] += Math.sin(w * i + phase) * g0 * mix * fade * wob
        }
      }
    }
  })

  // Filters settle over two throwaway periods, exactly as noiseBed does.
  const long = tile(tonal, 3)
  lowpass(long, 1600)
  highpass(long, 55)
  const pad = long.slice(2 * L)

  // A faint high bed of air, or headphones make the pad feel like a sealed room.
  const air = noiseBed(0xa11e, (b) => {
    highpass(b, 2600); lowpass(b, 7600)
  })

  const bed = new Float32Array(L)
  mixInto(bed, pad, 1)
  mixInto(bed, air, 0.012)

  // One slow swell per loop, phased so the seam falls in its trough.
  const g = periodicLfo(L, 1, -0.25)
  shape(bed, (_, i) => 1 + 0.12 * g[i])

  seamDip(bed, SEAM_DEPTH, SEAM_WIDTH)
  return normalise(bed, 0.085)
}

/** Distant thunder — a swell, not a crack. One-shot, so no loop constraint. */
function thunder(seed, seconds) {
  const rand = rng(seed)
  const n = Math.floor(seconds * SR)
  const body = whiteNoise(n, rand)
  lowpass(body, 260); lowpass(body, 260); lowpass(body, 260)
  shape(body, (t) => {
    const attack = Math.min(1, t / 0.09)          // ~0.5s swell in
    const decay = Math.exp(-t * 3.4)
    return attack * attack * decay
  })

  const low = whiteNoise(n, rand)
  bandpass(low, 85, 0.6)
  shape(low, (t) => Math.min(1, t / 0.05) * Math.exp(-t * 2.1))

  const out = new Float32Array(n)
  mixInto(out, body, 1)
  mixInto(out, low, 2.4)

  // A soft, far-away leading edge — muffled by distance, never a snap.
  const crackAt = Math.floor(0.28 * SR)
  const cn = Math.floor(0.4 * SR)
  const crack = whiteNoise(cn, rand)
  lowpass(crack, 900); lowpass(crack, 900)
  shape(crack, (t) => Math.exp(-t * 9))
  for (let i = 0; i < cn && crackAt + i < n; i++) out[crackAt + i] += crack[i] * 0.5

  const p = peak(out)
  if (p > 1e-9) scale(out, 0.5 / p)
  return fadeEdges(out, 80)
}

// ── encode ───────────────────────────────────────────────────────────────────

function encode(name, samples, kbps) {
  const wav = join(TMP, `${name}.wav`)
  const m4a = join(OUT, `${name}.m4a`)
  writeFileSync(wav, toWav(samples))
  const r = spawnSync(ffmpeg, [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-i', wav,
    '-c:a', 'aac', '-aac_coder', 'twoloop',
    '-b:a', `${kbps}k`, '-ac', '1', '-ar', String(SR),
    '-movflags', '+faststart',
    m4a,
  ], { stdio: 'inherit' })
  if (r.status !== 0) throw new Error(`ffmpeg failed for ${name}`)
  rmSync(wav)
  const kb = (statSync(m4a).size / 1024).toFixed(0)
  console.log(`  ${name}.m4a  ${String(kb).padStart(4)} KB  ${(samples.length / SR).toFixed(1)}s`)
}

mkdirSync(OUT, { recursive: true })
mkdirSync(TMP, { recursive: true })

console.log(`Generating audio (${LOOP}s seamless loops, mono AAC)…`)
encode('rain-base', rainBase(), 64)
encode('window-rain', windowRain(), 64)
encode('night-ambience', nightAmbience(), 64)
encode('drift', softChords(), 64)
encode('thunder-1', thunder(0x8a91, 7.0), 48)
encode('thunder-2', thunder(0xa2b3, 5.5), 48)
console.log('Done.')
