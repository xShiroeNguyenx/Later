import { ICONS } from './layers'

type Handlers = { pause(): void; play(): void; stop(): void }

/** Already translated by the caller — this module holds no copy of its own. */
export type MediaMeta = { artist: string; album: string }

/**
 * Lock-screen metadata and controls.
 *
 * Beyond being a nicety, claiming a media session is part of how the OS decides
 * this page is legitimately playing audio and should keep running with the
 * screen off — which the whole app depends on.
 */
export function setMediaSession(meta: MediaMeta, h: Handlers) {
  const ms = navigator.mediaSession
  if (!ms) return
  try {
    ms.metadata = new MediaMetadata({
      title: 'Later.',
      artist: meta.artist,
      album: meta.album,
      artwork: ICONS,
    })
    ms.setActionHandler('pause', h.pause)
    ms.setActionHandler('play', h.play)
    ms.setActionHandler('stop', h.stop)
    // Nothing to seek through, and a scrubber would only invite clock-watching.
    for (const a of ['seekbackward', 'seekforward', 'seekto', 'previoustrack', 'nexttrack'] as const) {
      ms.setActionHandler(a, null)
    }
    ms.playbackState = 'playing'
  } catch {
    /* older browsers: no lock-screen controls, everything else still works */
  }
}

export function setPlaybackState(state: MediaSessionPlaybackState) {
  try {
    if (navigator.mediaSession) navigator.mediaSession.playbackState = state
  } catch { /* ignore */ }
}

export function clearMediaSession() {
  const ms = navigator.mediaSession
  if (!ms) return
  try {
    ms.playbackState = 'none'
    ms.metadata = null
    for (const a of ['play', 'pause', 'stop'] as const) ms.setActionHandler(a, null)
  } catch { /* ignore */ }
}
