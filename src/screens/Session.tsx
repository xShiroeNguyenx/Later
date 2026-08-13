import { useEffect, useState } from 'react'
import { useT } from '../i18n'
import { Breath } from '../session/Breath'
import { useSession, type SessionConfig } from '../session/useSession'
import { useIdle } from '../lib/idle'

/** How long without being touched before the whole interface gets out of the way. */
const DIM_AFTER_MS = 12_000

type Props = {
  cfg: SessionConfig
  onExit: () => void
  onPark: () => void
  /** True while a sheet is covering the session — don't dim underneath it. */
  covered: boolean
}

export function Session({ cfg, onExit, onPark, covered }: Props) {
  const t = useT()
  const s = useSession(cfg, onExit)
  const idle = useIdle(DIM_AFTER_MS, !s.done && !s.paused && !covered)

  const cue = s.cueKey ? t.cue[s.cueKey] : null

  // The line has to outlive its own cue so it can fade out instead of vanishing.
  const [shown, setShown] = useState('')
  useEffect(() => {
    if (cue) setShown(cue)
  }, [cue])

  // Nothing but a dim moon. Whoever this is meant for is probably asleep; if not,
  // anywhere on the screen takes them back. A real button rather than a div with a
  // click handler, so a keyboard can dismiss it too.
  if (s.done) {
    return (
      <button className="screen session" onClick={onExit} aria-label={t.close}>
        <span
          className="moon"
          aria-hidden="true"
          style={{ opacity: 0.3, animation: 'fadein 2600ms var(--ease)' }}
        />
      </button>
    )
  }

  return (
    <div className="screen session" data-dim={idle ? '1' : '0'}>
      <div className="stage">
        {cfg.mode === 'calm' && <Breath cycle={s.cycle} />}
        {cfg.mode === 'rain' && <span className="glim" aria-hidden="true" />}
        <p className="cue" data-on={cue ? '1' : '0'} aria-live="polite">
          {shown}
        </p>
      </div>

      <div className="controls">
        {s.paused ? (
          <button className="ctrl" onClick={s.togglePause}>{t.ctrlResume}</button>
        ) : (
          <>
            <button className="ctrl" onClick={onPark}>{t.ctrlPark}</button>
            {!s.open && (
              <>
                <span className="sep" />
                <button className="ctrl" onClick={() => s.extend(-5)} aria-label={t.ariaLess}>−5</button>
                <button className="ctrl" onClick={() => s.extend(5)} aria-label={t.ariaMore}>+5</button>
              </>
            )}
          </>
        )}
        <span className="sep" />
        <button className="ctrl" onClick={s.end}>{t.ctrlEnd}</button>
      </div>
    </div>
  )
}
