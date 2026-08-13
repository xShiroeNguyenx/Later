import { LOOP_SECONDS, SEAM_HALF, bedFor } from './layers'
import { clearMediaSession, setMediaSession, setPlaybackState, type MediaMeta } from './mediaSession'
import { startTexture, type Texture } from './procedural'
import type { SoundId } from '../types'

/**
 * Two layers, for one reason: the app has to keep playing with the screen
 * locked, and only one of the two web audio APIs can do that.
 *
 *   BED      a plain <audio loop> on an AAC/M4A file. Untouched by Web Audio,
 *            so iOS treats it as ordinary media playback and keeps it running
 *            all night. This is the layer that matters.
 *
 *   TEXTURE  a Web Audio graph (droplets, shimmer, thunder) that hides the
 *            48-second loop point. iOS suspends it on lock; that is fine, it is
 *            garnish and the bed carries on alone.
 *
 * The awkward part is fading. iOS Safari makes HTMLMediaElement.volume
 * read-only, so on iPhone there is no software fade available at all. Instead
 * the beds are generated with a lull authored into the loop seam, and playback
 * starts and stops inside that lull — see seamDip() in scripts/dsp.mjs.
 */

const FADE_STEP_MS = 45

type Handlers = { pause(): void; play(): void; stop(): void }

let bed: HTMLAudioElement | null = null
let bedSound: SoundId = 'none'
let ctx: AudioContext | null = null
let master: GainNode | null = null
let texture: Texture | null = null

let level = 1
let fadeSupported: boolean | null = null
let lullArmed = false
let stopped = true
let fadeTimer = 0
let unlockBound = false

const ticks = new Set<() => void>()
const stopSubs = new Set<() => void>()
const notify = () => {
  for (const cb of ticks) cb()
  if (lullArmed && bed && inLull(bed.currentTime)) stop()
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)

/** Inside the authored dip at the loop seam, where starting/stopping is soft. */
const inLull = (t: number) => t <= SEAM_HALF || t >= LOOP_SECONDS - SEAM_HALF

/**
 * iOS ignores writes to .volume. Detect it once on the real element rather than
 * sniffing the user agent.
 */
function detectFadeSupport(el: HTMLAudioElement): boolean {
  const before = el.volume
  try {
    el.volume = 0.5
    const ok = Math.abs(el.volume - 0.5) < 1e-6
    el.volume = before
    return ok
  } catch {
    return false
  }
}

const primed = new Set<string>()

/**
 * Pulls the bed through a plain fetch so the service worker can cache it.
 *
 * A media element asks for byte ranges and gets a 206 back, which is not a
 * cacheable response — left to itself the bed would never land in the cache and
 * the app would be useless on a plane or with the wifi off. One ordinary fetch
 * puts a full 200 in there; the element's range requests are then served out of
 * it by workbox's RangeRequests plugin.
 *
 * Buffering on the element is switched on only afterwards, so the file is pulled
 * over the network exactly once.
 */
function primeCache(file: string, el: HTMLAudioElement) {
  if (primed.has(file)) {
    el.preload = 'auto'
    return
  }
  primed.add(file)
  const done = () => { el.preload = 'auto' }
  fetch(file)
    .then((r) => r.arrayBuffer())
    .then(done)
    .catch(done)
}

function makeBed(file: string): HTMLAudioElement {
  const el = document.createElement('audio')
  el.preload = 'none'
  el.loop = true
  el.src = file
  el.addEventListener('timeupdate', notify)
  primeCache(file, el)
  return el
}

/** Adopts the element the inline boot script may already have playing. */
function acquire(sound: SoundId): HTMLAudioElement | null {
  const spec = bedFor(sound)
  if (!spec) return null
  if (bed && bedSound === sound) return bed
  if (bed) {
    bed.pause()
    bed.removeEventListener('timeupdate', notify)
  }
  const adopted = window.__laterBed
  if (adopted && window.__laterBedSound === sound) {
    adopted.loop = true
    adopted.addEventListener('timeupdate', notify)
    // The boot script builds its element without going through makeBed, so the
    // offline cache still needs filling.
    primeCache(spec.file, adopted)
    bed = adopted
  } else {
    bed = makeBed(spec.file)
    window.__laterBed = bed
    window.__laterBedSound = sound
  }
  bedSound = sound
  return bed
}

function ensureContext(): AudioContext | null {
  if (ctx) return ctx
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AC) return null
  ctx = new AC()
  master = ctx.createGain()
  master.gain.value = 1
  master.connect(ctx.destination)
  return ctx
}

/**
 * A tap on Rest before hydration starts the bed but cannot resume an
 * AudioContext that does not exist yet. Catch the next tap anywhere to bring
 * the texture layer in.
 */
function bindUnlock() {
  if (unlockBound) return
  unlockBound = true
  const unlock = () => {
    if (ctx && ctx.state === 'suspended' && !stopped) void ctx.resume()
  }
  window.addEventListener('pointerdown', unlock, { passive: true })
}

// ── public API ───────────────────────────────────────────────────────────────

/** Buffers the bed during idle time so the first tap plays instantly. */
export function warm(sound: SoundId) {
  const spec = bedFor(sound)
  if (!spec || window.__laterBed) return
  const el = makeBed(spec.file)
  window.__laterBed = el
  window.__laterBedSound = sound
  bed = el
  bedSound = sound
}

/** MUST be called synchronously inside a user gesture, or autoplay blocks it. */
export function start(sound: SoundId, meta: MediaMeta, handlers: Handlers) {
  stopped = false
  lullArmed = false
  clearTimeout(fadeTimer)

  const el = acquire(sound)
  if (el) {
    if (fadeSupported === null) fadeSupported = detectFadeSupport(el)
    // Begin inside the seam lull so the entry is gentle even where .volume is
    // read-only. A bed the boot script already started is left alone.
    if (el.paused) {
      if (el.currentTime > SEAM_HALF) el.currentTime = 0
      if (fadeSupported) el.volume = 0
      void el.play().catch(() => {})
    }
    setMediaSession(meta, handlers)
  }

  const spec = bedFor(sound)
  if (spec) {
    const c = ensureContext()
    if (c && master) {
      if (c.state === 'suspended') void c.resume().catch(() => {})
      texture?.stop()
      texture = startTexture(c, master, spec.texture)
      bindUnlock()
    }
  }
  // Always from silence. Where .volume is read-only this is a no-op for the bed
  // (the seam lull covers its entry) but the texture layer still fades in.
  setLevel(0)
}

export const supportsFade = () => fadeSupported !== false

/** 0…1 target loudness. Called on every session tick, so it must be cheap. */
export function setLevel(v: number) {
  level = clamp01(v)
  if (bed && fadeSupported) {
    try { bed.volume = level } catch { /* ignore */ }
  }
  texture?.setGain(level, 0.35)
}

export const getLevel = () => level

export function pauseBed() {
  bed?.pause()
  texture?.setGain(0, 0.25)
  setPlaybackState('paused')
}

export function resumeBed() {
  if (bed?.paused) void bed.play().catch(() => {})
  if (ctx?.state === 'suspended') void ctx.resume().catch(() => {})
  texture?.setGain(level, 0.4)
  setPlaybackState('playing')
}

/**
 * Ends the session at the next loop seam. Used when .volume is unavailable: the
 * lull in the bed is the fade, so we wait for it rather than cutting out mid
 * downpour. Lands within ~±24s of the requested time, which is well inside what
 * a sleep timer needs to be.
 */
export function armLullStop() {
  if (!bed) {
    stop()
    return
  }
  lullArmed = true
  notify()
}

/** Explicit stop (the End button, or a timer end where fading works). */
export function fadeOutAndStop(ms: number) {
  clearTimeout(fadeTimer)
  if (!bed && !texture) {
    stop()
    return
  }

  if (bed && !fadeSupported) {
    // Can't touch volume, so jump into the authored dip and let the content
    // fade itself out over the last second before pausing.
    try { bed.currentTime = LOOP_SECONDS - 1.1 } catch { /* ignore */ }
    texture?.setGain(0, 0.6)
    fadeTimer = setTimeout(stop, 1200) as unknown as number
    return
  }

  const from = level
  const steps = Math.max(1, Math.round(ms / FADE_STEP_MS))
  let i = 0
  const id = setInterval(() => {
    i++
    setLevel(from * Math.pow(1 - i / steps, 1.7))
    if (i >= steps) {
      clearInterval(id)
      stop()
    }
  }, FADE_STEP_MS)
  fadeTimer = id as unknown as number
}

export function stop() {
  const wasRunning = !stopped
  stopped = true
  lullArmed = false
  clearTimeout(fadeTimer)
  if (bed) {
    bed.pause()
    try { bed.currentTime = 0 } catch { /* ignore */ }
  }
  texture?.stop()
  texture = null
  clearMediaSession()
  if (ctx?.state === 'running') void ctx.suspend().catch(() => {})
  if (wasRunning) for (const cb of [...stopSubs]) cb()
}

export const isStopped = () => stopped

/** Fires whenever playback actually ends — including at a loop-seam stop, whose
 *  exact moment is decided by the audio position rather than by any timer. */
export function onStopped(cb: () => void): () => void {
  stopSubs.add(cb)
  return () => stopSubs.delete(cb)
}

/**
 * The session clock. `timeupdate` fires about four times a second and — unlike
 * setInterval — keeps firing while the screen is off, because the page counts as
 * audible. Silent modes fall back to their own interval.
 */
export function onTick(cb: () => void): () => void {
  ticks.add(cb)
  return () => ticks.delete(cb)
}

export function syncVisibility() {
  if (stopped || document.hidden) return
  if (ctx?.state === 'suspended') void ctx.resume().catch(() => {})
}
