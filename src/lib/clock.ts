import { useEffect, useState } from 'react'
import type { Lang } from '../i18n'

/**
 * English gets 12-hour with a meridiem ("2:17 AM"); Vietnamese gets 24-hour
 * ("2:17"), which is how people there actually read a clock. The inline script in
 * index.html contains the same two rules — keep them in step.
 */
export function formatClock(d: Date, lang: Lang): string {
  const h = d.getHours()
  const m = String(d.getMinutes()).padStart(2, '0')
  if (lang === 'vi') return `${h}:${m}`
  return `${h % 12 || 12}:${m} ${h < 12 ? 'AM' : 'PM'}`
}

/**
 * True between 20:00 and 06:00.
 *
 * This gates the parked-thoughts list, and it is the most important rule in the
 * app: showing someone their own worries back at 2 AM restarts precisely the loop
 * the app exists to interrupt.
 */
export function isNightTime(d = new Date()): boolean {
  const h = d.getHours()
  return h >= 20 || h < 6
}

/** Whole calendar days between then and now. */
export function daysAgo(ts: number): number {
  const then = new Date(ts)
  const now = new Date()
  const midnight = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  return Math.round((midnight(now) - midnight(then)) / 86_400_000)
}

/** The clock on the home screen. Updated every 15s — it is never the point. */
export function useClock(lang: Lang): string {
  const [t, setT] = useState(() => formatClock(new Date(), lang))
  useEffect(() => {
    setT(formatClock(new Date(), lang))
    const id = setInterval(() => setT(formatClock(new Date(), lang)), 15_000)
    return () => clearInterval(id)
  }, [lang])
  return t
}
