import { useEffect, useRef, useState } from 'react'
import { useT } from '../i18n'

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
 *
 * In Breathe mode (`guided`) the orb gets words: "breathe in" / "breathe out",
 * driven by the animation's own events rather than a separate clock, so the
 * label can never drift out of step with the motion — even while the cycle is
 * slowing down. Each iteration start IS the start of an in-breath; the turn to
 * the out-breath sits at 40% of the cycle, where the keyframes put it.
 */
export function Breath({ cycle, guided = false }: { cycle: number; guided?: boolean }) {
  const t = useT()
  const ref = useRef<HTMLDivElement>(null)
  const target = useRef(cycle)
  const applied = useRef(cycle)
  const [phase, setPhase] = useState<'in' | 'out'>('in')

  target.current = cycle

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.setProperty('--cycle', `${applied.current}s`)

    let swap = 0
    const markIn = () => {
      if (!guided) return
      setPhase('in')
      clearTimeout(swap)
      swap = window.setTimeout(() => setPhase('out'), applied.current * 400) // 40% of the cycle, in ms
    }

    const onIteration = () => {
      if (Math.abs(target.current - applied.current) >= 0.15) {
        applied.current = target.current
        el.style.setProperty('--cycle', `${applied.current}s`)
      }
      markIn()
    }

    markIn() // the animation starts the moment the orb mounts
    el.addEventListener('animationiteration', onIteration)
    return () => {
      el.removeEventListener('animationiteration', onIteration)
      clearTimeout(swap)
    }
  }, [guided])

  return (
    <>
      <div className="orb" ref={ref} aria-hidden="true" />
      {guided && (
        // aria-hidden: a label that changes every few seconds all night would
        // turn a screen reader into the opposite of a sleep aid.
        <span className="phase" aria-hidden="true">
          {phase === 'in' ? t.phaseIn : t.phaseOut}
        </span>
      )}
    </>
  )
}
