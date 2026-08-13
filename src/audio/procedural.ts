import { THUNDER_FILES, type TextureSpec } from './layers'

/**
 * The texture layer: everything the 48-second bed loop cannot provide on its
 * own. Droplets, a whisper of shimmer, stray crickets and distant thunder, all
 * placed at random so the ear never finds the loop.
 *
 * This layer runs on Web Audio, which means iOS suspends it the moment the
 * screen locks. That is by design and why it is only ever a garnish — the bed
 * element carries the sound that has to survive the night.
 */

const LOOKAHEAD_S = 0.6
const SCHEDULE_MS = 220

let noiseBuffer: AudioBuffer | null = null
let thunderBuffers: (AudioBuffer | null)[] = []

function getNoise(ctx: AudioContext): AudioBuffer {
  if (noiseBuffer && noiseBuffer.sampleRate === ctx.sampleRate) return noiseBuffer
  const n = Math.floor(ctx.sampleRate * 3)
  const buf = ctx.createBuffer(1, n, ctx.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1
  noiseBuffer = buf
  return buf
}

/** Loads the thunder one-shots once, lazily, and never blocks anything on it. */
async function loadThunder(ctx: AudioContext) {
  if (thunderBuffers.length) return
  thunderBuffers = THUNDER_FILES.map(() => null)
  await Promise.all(
    THUNDER_FILES.map(async (url, i) => {
      try {
        const res = await fetch(url)
        thunderBuffers[i] = await ctx.decodeAudioData(await res.arrayBuffer())
      } catch {
        /* no thunder tonight */
      }
    }),
  )
}

const rand = (a: number, b: number) => a + Math.random() * (b - a)

export type Texture = {
  setGain(v: number, rampS?: number): void
  stop(): void
}

export function startTexture(ctx: AudioContext, dest: AudioNode, spec: TextureSpec): Texture {
  const out = ctx.createGain()
  out.gain.value = 0
  out.connect(dest)

  const stops: Array<() => void> = []
  let alive = true

  // ── shimmer: a continuous, band-limited whisper with slow gain drift ──────
  if (spec.shimmer) {
    const src = ctx.createBufferSource()
    src.buffer = getNoise(ctx)
    src.loop = true
    const hp = ctx.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = spec.shimmer.hp
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = spec.shimmer.lp
    const g = ctx.createGain()
    g.gain.value = spec.shimmer.gain

    // A very slow LFO so the top end breathes instead of sitting still.
    const lfo = ctx.createOscillator()
    lfo.frequency.value = 0.035
    const lfoAmt = ctx.createGain()
    lfoAmt.gain.value = spec.shimmer.gain * 0.55
    lfo.connect(lfoAmt).connect(g.gain)
    lfo.start()

    src.connect(hp).connect(lp).connect(g).connect(out)
    src.start()
    stops.push(() => {
      try { src.stop(); lfo.stop() } catch { /* already stopped */ }
      src.disconnect(); lfo.disconnect()
    })
  }

  // ── one-shot voices, scheduled just ahead of the clock ────────────────────

  function droplet(at: number) {
    const d = spec.drops!
    const src = ctx.createBufferSource()
    src.buffer = getNoise(ctx)
    src.loop = false
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = rand(d.fMin, d.fMax)
    bp.Q.value = d.q
    const g = ctx.createGain()
    const decay = rand(d.decayMs[0], d.decayMs[1]) / 1000
    const peak = d.gain * rand(0.45, 1)
    g.gain.setValueAtTime(0, at)
    g.gain.linearRampToValueAtTime(peak, at + 0.002)
    g.gain.exponentialRampToValueAtTime(0.0001, at + decay * 4)
    src.connect(bp).connect(g).connect(out)
    src.start(at, rand(0, 2), decay * 4 + 0.05)
    src.onended = () => { src.disconnect(); bp.disconnect(); g.disconnect() }
  }

  function chirp(at: number) {
    const c = spec.chirps!
    const pulses = 3 + Math.floor(Math.random() * 2)
    const freq = c.freq * rand(0.985, 1.015)
    for (let p = 0; p < pulses; p++) {
      const t = at + p * 0.055
      const osc = ctx.createOscillator()
      osc.frequency.value = freq
      const g = ctx.createGain()
      g.gain.setValueAtTime(0, t)
      g.gain.linearRampToValueAtTime(c.gain, t + 0.007)
      g.gain.linearRampToValueAtTime(0, t + 0.017)
      osc.connect(g).connect(out)
      osc.start(t)
      osc.stop(t + 0.02)
      osc.onended = () => { osc.disconnect(); g.disconnect() }
    }
  }

  function thunder(at: number) {
    const buf = thunderBuffers[Math.floor(Math.random() * thunderBuffers.length)]
    if (!buf) return
    const src = ctx.createBufferSource()
    src.buffer = buf
    const g = ctx.createGain()
    g.gain.value = spec.thunder!.gain * rand(0.55, 1)
    src.connect(g).connect(out)
    src.start(at)
    src.onended = () => { src.disconnect(); g.disconnect() }
  }

  // Next scheduled time for each voice, in AudioContext time.
  let nextDrop = ctx.currentTime
  let nextChirp = ctx.currentTime + rand(1, 4)
  let nextThunder = ctx.currentTime + (spec.thunder ? rand(20, 50) : Infinity)

  if (spec.thunder) void loadThunder(ctx)

  const timer = setInterval(() => {
    if (!alive) return
    // Frozen clock (backgrounded / suspended context) would dump every pending
    // event at once the moment it resumes, so simply do not schedule.
    if (ctx.state !== 'running' || document.hidden) {
      const now = ctx.currentTime
      nextDrop = Math.max(nextDrop, now)
      nextChirp = Math.max(nextChirp, now)
      nextThunder = Math.max(nextThunder, now)
      return
    }
    const until = ctx.currentTime + LOOKAHEAD_S
    if (spec.drops) {
      while (nextDrop < until) {
        droplet(nextDrop)
        nextDrop += rand(0.35, 1.65) / spec.drops.rate
      }
    }
    if (spec.chirps) {
      while (nextChirp < until) {
        chirp(nextChirp)
        nextChirp += rand(0.5, 1.8) / spec.chirps.rate
      }
    }
    if (spec.thunder) {
      while (nextThunder < until) {
        thunder(nextThunder)
        nextThunder += rand(spec.thunder.gap[0], spec.thunder.gap[1])
      }
    }
  }, SCHEDULE_MS)

  return {
    setGain(v, rampS = 0.4) {
      const now = ctx.currentTime
      out.gain.cancelScheduledValues(now)
      out.gain.setTargetAtTime(v, now, Math.max(0.02, rampS / 3))
    },
    stop() {
      alive = false
      clearInterval(timer)
      const now = ctx.currentTime
      out.gain.cancelScheduledValues(now)
      out.gain.setTargetAtTime(0, now, 0.12)
      // Let the tail ring out before tearing the graph down.
      setTimeout(() => {
        for (const s of stops) s()
        out.disconnect()
      }, 900)
    },
  }
}
