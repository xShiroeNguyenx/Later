/**
 * Lock-screen controls have to be handed to the audio engine inside the tap that
 * starts playback — before the session hook that implements them exists. This
 * mutable box bridges that gap: the engine holds the box, the session fills it
 * in on mount and empties it on unmount.
 */
export const remote = {
  pause: () => {},
  play: () => {},
  stop: () => {},
}

export function resetRemote() {
  remote.pause = () => {}
  remote.play = () => {}
  remote.stop = () => {}
}
