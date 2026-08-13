import { useT } from '../i18n'
import { isNightTime, useClock } from '../lib/clock'
import { listThoughts } from '../park/storage'
import type { Draft } from '../types'

type Props = {
  /** null on a first visit — that is what changes the wording. */
  prefs: Draft | null
  draft: Draft
  label: string
  onRest: () => void
  onPicker: () => void
  onPark: () => void
  onParked: () => void
}

export function Home({ prefs, draft, label, onRest, onPicker, onPark, onParked }: Props) {
  const t = useT()
  const now = useClock(draft.lang)

  // Parked thoughts are never surfaced at night. Reading your own worries back
  // at 2 AM restarts precisely the loop this app exists to interrupt.
  const parked = isNightTime() ? [] : listThoughts()

  return (
    <div className="screen">
      <span className="clock">{now}</span>
      <span className="moon" aria-hidden="true" />

      <h1 className="lede">{prefs ? t.ledeBack : t.ledeFirst}</h1>

      <button className="rest" onClick={onRest}>
        {prefs ? t.restAgain : t.rest}
      </button>

      <div className="foot">
        <span className="rule" />
        <button className="summary" onClick={onPicker}>{label}</button>
        {parked.length > 0 ? (
          <button className="tiny" onClick={onParked}>
            {t.parkedLine(parked.length, t.relativeDay(parked[0].parkedAt))}
          </button>
        ) : (
          <button className="tiny" onClick={onPark}>{t.parkCta}</button>
        )}
      </div>
    </div>
  )
}
