// Minimal DSP toolkit for offline audio generation.
// No dependencies — everything here is plain float math.

export const SR = 48000

/** Deterministic PRNG (mulberry32) so regenerating assets is reproducible. */
export function rng(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** White noise in [-1, 1). */
export function whiteNoise(n, rand) {
  const out = new Float32Array(n)
  for (let i = 0; i < n; i++) out[i] = rand() * 2 - 1
  return out
}

// ── Biquad filters (RBJ cookbook) ────────────────────────────────────────────

function lowpassCoeffs(fc, q) {
  const w = (2 * Math.PI * fc) / SR
  const cw = Math.cos(w)
  const alpha = Math.sin(w) / (2 * q)
  const b0 = (1 - cw) / 2
  const b1 = 1 - cw
  const b2 = (1 - cw) / 2
  const a0 = 1 + alpha
  const a1 = -2 * cw
  const a2 = 1 - alpha
  return [b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0]
}

function highpassCoeffs(fc, q) {
  const w = (2 * Math.PI * fc) / SR
  const cw = Math.cos(w)
  const alpha = Math.sin(w) / (2 * q)
  const b0 = (1 + cw) / 2
  const b1 = -(1 + cw)
  const b2 = (1 + cw) / 2
  const a0 = 1 + alpha
  const a1 = -2 * cw
  const a2 = 1 - alpha
  return [b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0]
}

function bandpassCoeffs(fc, q) {
  const w = (2 * Math.PI * fc) / SR
  const cw = Math.cos(w)
  const sw = Math.sin(w)
  const alpha = sw / (2 * q)
  const b0 = alpha
  const b1 = 0
  const b2 = -alpha
  const a0 = 1 + alpha
  const a1 = -2 * cw
  const a2 = 1 - alpha
  return [b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0]
}

function peakCoeffs(fc, q, gainDb) {
  const A = Math.pow(10, gainDb / 40)
  const w = (2 * Math.PI * fc) / SR
  const cw = Math.cos(w)
  const alpha = Math.sin(w) / (2 * q)
  const b0 = 1 + alpha * A
  const b1 = -2 * cw
  const b2 = 1 - alpha * A
  const a0 = 1 + alpha / A
  const a1 = -2 * cw
  const a2 = 1 - alpha / A
  return [b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0]
}

/** Runs a biquad over `buf` in place. Direct form 1. */
function runBiquad(buf, c) {
  const [b0, b1, b2, a1, a2] = c
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0
  for (let i = 0; i < buf.length; i++) {
    const x0 = buf[i]
    const y0 = b0 * x0 + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2
    x2 = x1; x1 = x0; y2 = y1; y1 = y0
    buf[i] = y0
  }
  return buf
}

export const lowpass = (buf, fc, q = 0.707) => runBiquad(buf, lowpassCoeffs(fc, q))
export const highpass = (buf, fc, q = 0.707) => runBiquad(buf, highpassCoeffs(fc, q))
export const bandpass = (buf, fc, q = 1) => runBiquad(buf, bandpassCoeffs(fc, q))
export const peaking = (buf, fc, q, db) => runBiquad(buf, peakCoeffs(fc, q, db))

// ── Buffer helpers ───────────────────────────────────────────────────────────

export const copy = (buf) => Float32Array.from(buf)

/** Repeats `buf` `times` over — used by the seamless-loop trick below. */
export function tile(buf, times) {
  const out = new Float32Array(buf.length * times)
  for (let t = 0; t < times; t++) out.set(buf, t * buf.length)
  return out
}

/** dst += src * gain */
export function mixInto(dst, src, gain = 1) {
  const n = Math.min(dst.length, src.length)
  for (let i = 0; i < n; i++) dst[i] += src[i] * gain
  return dst
}

export function scale(buf, gain) {
  for (let i = 0; i < buf.length; i++) buf[i] *= gain
  return buf
}

/** Multiplies buf by a per-sample envelope function of normalised position. */
export function shape(buf, fn) {
  const n = buf.length
  for (let i = 0; i < n; i++) buf[i] *= fn(i / n, i)
  return buf
}

export function rms(buf) {
  let s = 0
  for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i]
  return Math.sqrt(s / buf.length)
}

export function peak(buf) {
  let p = 0
  for (let i = 0; i < buf.length; i++) p = Math.max(p, Math.abs(buf[i]))
  return p
}

/** Normalises to a target RMS, then soft-clips so transients never wrap. */
export function normalise(buf, targetRms, ceiling = 0.92) {
  const r = rms(buf)
  if (r > 1e-9) scale(buf, targetRms / r)
  for (let i = 0; i < buf.length; i++) {
    buf[i] = Math.tanh(buf[i] / ceiling) * ceiling
  }
  return buf
}

/**
 * THE SEAMLESS LOOP TRICK.
 *
 * Filters carry state, so filtering one period of a periodic signal leaves a
 * startup transient at the head and a discontinuity at the wrap point. Instead
 * we tile the (already exactly periodic) source `times` over, filter the whole
 * thing, and keep only the LAST period — by then the filter has settled into
 * its steady-state periodic response, so tail joins head exactly.
 */
export function loopSafe(periodLen, times, build) {
  const long = build(periodLen * times)
  return long.slice(periodLen * (times - 1))
}

/**
 * Places a short event into a buffer at `pos`, wrapping past the end back to
 * the start. Wrapping is what keeps the source exactly periodic.
 */
export function addWrapped(dst, event, pos, gain = 1) {
  const n = dst.length
  for (let i = 0; i < event.length; i++) {
    dst[(pos + i) % n] += event[i] * gain
  }
}

/** Sum of integer-cycle sines — guaranteed periodic over the loop. */
export function periodicLfo(n, cycles, phase = 0) {
  const out = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    out[i] = Math.sin(2 * Math.PI * (cycles * (i / n) + phase))
  }
  return out
}

/**
 * Authors a gentle lull centred on the loop seam (sample 0), wrapping around.
 *
 * This is not cosmetic. iOS Safari makes `HTMLMediaElement.volume` read-only,
 * so on iPhone we cannot fade the bed in software — instead the app starts and
 * stops playback *inside this dip*, and the envelope does the fading for us.
 * Rain really does ebb like this, so it reads as natural either way.
 */
export function seamDip(buf, depth, widthS) {
  const n = buf.length
  const w = widthS * SR
  for (let i = 0; i < n; i++) {
    const d = Math.min(i, n - i) / w
    if (d >= 1) continue
    const window = Math.cos((Math.PI * d) / 2) ** 2 // 1 at the seam, 0 at the edge
    buf[i] *= 1 - depth * window
  }
  return buf
}

export function fadeEdges(buf, ms) {
  const k = Math.min(Math.floor((ms / 1000) * SR), Math.floor(buf.length / 2))
  for (let i = 0; i < k; i++) {
    const g = i / k
    buf[i] *= g
    buf[buf.length - 1 - i] *= g
  }
  return buf
}

// ── WAV writer (16-bit PCM mono) ─────────────────────────────────────────────

export function toWav(buf) {
  const n = buf.length
  const out = Buffer.alloc(44 + n * 2)
  out.write('RIFF', 0)
  out.writeUInt32LE(36 + n * 2, 4)
  out.write('WAVE', 8)
  out.write('fmt ', 12)
  out.writeUInt32LE(16, 16)
  out.writeUInt16LE(1, 20)          // PCM
  out.writeUInt16LE(1, 22)          // mono
  out.writeUInt32LE(SR, 24)
  out.writeUInt32LE(SR * 2, 28)     // byte rate
  out.writeUInt16LE(2, 32)          // block align
  out.writeUInt16LE(16, 34)         // bits
  out.write('data', 36)
  out.writeUInt32LE(n * 2, 40)
  for (let i = 0; i < n; i++) {
    const s = Math.max(-1, Math.min(1, buf[i]))
    out.writeInt16LE(Math.round(s * 32767), 44 + i * 2)
  }
  return out
}
