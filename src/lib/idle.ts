import { useEffect, useState } from 'react'

/**
 * Goes true after `delayMs` without any input, false again on the next touch.
 *
 * This is how the session screen disappears without asking anyone to do
 * anything. Deliberately does NOT listen to mousemove — a phone lying on a duvet
 * generates stray events, and waking the UI back up by accident defeats it.
 */
export function useIdle(delayMs: number, active = true): boolean {
  const [idle, setIdle] = useState(false)

  useEffect(() => {
    if (!active) {
      setIdle(false)
      return
    }
    let timer = 0
    const arm = () => {
      clearTimeout(timer)
      timer = setTimeout(() => setIdle(true), delayMs) as unknown as number
    }
    const wake = () => {
      setIdle(false)
      arm()
    }
    const events = ['pointerdown', 'keydown', 'touchstart', 'wheel'] as const
    for (const e of events) window.addEventListener(e, wake, { passive: true })
    arm()
    return () => {
      clearTimeout(timer)
      for (const e of events) window.removeEventListener(e, wake)
    }
  }, [delayMs, active])

  return idle
}
