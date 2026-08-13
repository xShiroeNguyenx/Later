import { useEffect, useRef } from 'react'

/**
 * The breathing guide: 4 seconds in, 6 seconds out.
 *
 * The longer exhale is the point. A longer out-breath than in-breath is what
 * actually engages the parasympathetic side — an even 1:1 rhythm looks just as
 * nice and does considerably less. (4-7-8 was considered and dropped: holding
 * for seven seconds is unpleasant if you have never practised it, and can make
 * an anxious person more anxious, not less.)
 *
 * Animated by CSS rather than JavaScript so it runs on the compositor and does
 * not depend on requestAnimationFrame, which stops dead in a background tab.
 * The cycle length lengthens towards the end of a session — applied only on an
 * `animationiteration` boundary, since changing a duration mid-cycle makes the
 * orb visibly jump.
 */
export function Breath({ cycle }: { cycle: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const target = useRef(cycle)
  const applied = useRef(cycle)

  target.current = cycle

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.setProperty('--cycle', `${applied.current}s`)

    const onIteration = () => {
      if (Math.abs(target.current - applied.current) < 0.15) return
      applied.current = target.current
      el.style.setProperty('--cycle', `${applied.current}s`)
    }
    el.addEventListener('animationiteration', onIteration)
    return () => el.removeEventListener('animationiteration', onIteration)
  }, [])

  return <div className="orb" ref={ref} aria-hidden="true" />
}
