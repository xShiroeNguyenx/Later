import { useCallback, useEffect, useRef, useState } from 'react'
import * as engine from '../audio/engine'
import { LOOP_SECONDS } from '../audio/layers'
import type { Mode, SoundId } from '../types'
import { cueAt, type CueKey } from './scripts'
import { remote, resetRemote } from './remote'

export type SessionConfig = { mode: Mode; sound: SoundId; minutes: number | null }

const FADE_IN_S = 20
const ORB_CYCLE_S = 10
const ORB_SLOWEST_S = 14

/** Long enough to be a real ending, short enough not to eat a 10-minute timer. */
const fadeOutFor = (minutes: number | null) =>
  minutes === null ? 0 : Math.min(120, (minutes * 60) / 6)

/**
 * The session clock and everything derived from it.
 *
 * Two rules drive the whole design:
 *
 *  1. Time comes from Date.now(), never from counting ticks. Background tabs get
 *     their timers throttled hard, so a session that counted intervals would
 *     drift by minutes with the screen off. Every tick recomputes from
 *     timestamps, which makes a missed tick harmless.
 *
 *  2. Ticks arrive from the bed's `timeupdate` event as well as an interval.
 *     A page playing audio is exempt from timer throttling, but `timeupdate`
 *     is the signal that is genuinely tied to the audio and keeps coming while
 *     the phone is locked.
 *
 * Returns the cue as a key, not a sentence: the caller translates it, so the
 * timeline never has to know which language is on screen.
 */
export function useSession(cfg: SessionConfig, onExit: () => void) {
  const [cueKey, setCueKey] = useState<CueKey | null>(null)
  const [cycle, setCycle] = useState(ORB_CYCLE_S)
  const [paused, setPaused] = useState(false)
  const [done, setDone] = useState(false)

  const clock = useRef({
    startedAt: Date.now(),
    endAt: cfg.minutes === null ? null : Date.now() + cfg.minutes * 60_000,
    pausedAt: null as number | null,
  })
  const ending = useRef(false)
  const exiting = useRef(false)
  const tickRef = useRef<() => void>(() => {})

  const tick = useCallback(() => {
    const s = clock.current
    if (s.pausedAt !== null || done) return

    const elapsed = (Date.now() - s.startedAt) / 1000
    const total = s.endAt === null ? null : (s.endAt - s.startedAt) / 1000
    const fadeOut = fadeOutFor(cfg.minutes)
    const remaining = total === null ? Infinity : total - elapsed

    // ── loudness ────────────────────────────────────────────────────────────
    let level = elapsed < FADE_IN_S ? Math.pow(elapsed / FADE_IN_S, 1.4) : 1
    if (fadeOut > 0 && remaining < fadeOut) {
      level = Math.min(level, Math.pow(Math.max(0, remaining) / fadeOut, 1.7))
    }
    engine.setLevel(level)

    // ── words and breath ────────────────────────────────────────────────────
    setCueKey(cueAt(cfg.mode, elapsed, total))
    const slow =
      fadeOut > 0 && remaining < fadeOut
        ? ORB_CYCLE_S + (ORB_SLOWEST_S - ORB_CYCLE_S) * (1 - Math.max(0, remaining) / fadeOut)
        : ORB_CYCLE_S
    setCycle(Math.round(slow * 5) / 5)

    // ── ending ──────────────────────────────────────────────────────────────
    if (total === null || ending.current) return

    if (engine.supportsFade()) {
      // Volume worked all the way down, so stopping now is already silent.
      if (remaining <= 0) {
        ending.current = true
        engine.fadeOutAndStop(500)
      }
    } else if (remaining <= LOOP_SECONDS / 2) {
      // No software fade available (iOS). Hand the ending to the audio itself:
      // stop at the lull authored into the loop seam, within ~±24s of target.
      ending.current = true
      engine.armLullStop()
    }
  }, [cfg.minutes, cfg.mode, done])

  tickRef.current = tick

  // ── control surface (also wired to the lock screen) ────────────────────────

  const togglePause = useCallback(() => {
    const s = clock.current
    if (s.pausedAt === null) {
      s.pausedAt = Date.now()
      engine.pauseBed()
      setPaused(true)
    } else {
      // Shift the whole window forward so paused time simply did not happen.
      const held = Date.now() - s.pausedAt
      s.startedAt += held
      if (s.endAt !== null) s.endAt += held
      s.pausedAt = null
      engine.resumeBed()
      setPaused(false)
      tickRef.current()
    }
  }, [])

  const end = useCallback(() => {
    ending.current = true
    exiting.current = true
    engine.fadeOutAndStop(2500)
    onExit()
  }, [onExit])

  const extend = useCallback((deltaMinutes: number) => {
    const s = clock.current
    if (s.endAt === null || ending.current) return
    s.endAt = Math.max(Date.now() + 60_000, s.endAt + deltaMinutes * 60_000)
    tickRef.current()
  }, [])

  // ── wiring ────────────────────────────────────────────────────────────────

  useEffect(() => {
    const run = () => tickRef.current()

    const offTick = engine.onTick(run)
    const offStop = engine.onStopped(() => {
      if (!exiting.current) setDone(true)
    })
    // Backstop for silent sessions (Empty Mind), where there is no timeupdate.
    const interval = setInterval(run, 500)
    const onVisible = () => {
      engine.syncVisibility()
      run()
    }
    document.addEventListener('visibilitychange', onVisible)

    remote.pause = togglePause
    remote.play = togglePause
    remote.stop = () => {
      exiting.current = true
      engine.stop()
      onExit()
    }

    run()

    return () => {
      offTick()
      offStop()
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
      resetRemote()
      // A fade already in flight owns the shutdown; don't cut it short.
      if (!ending.current) engine.stop()
    }
  }, [togglePause, onExit])

  return { cueKey, cycle, paused, done, togglePause, end, extend, open: cfg.minutes === null }
}
