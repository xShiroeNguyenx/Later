import { useCallback, useEffect, useMemo, useState } from 'react'
import * as engine from './audio/engine'
import { I18nProvider, STRINGS } from './i18n'
import { composeLabel, defaults, loadPrefs, savePrefs } from './lib/prefs'
import { ParkSheet } from './park/ParkSheet'
import { ParkedList } from './park/ParkedList'
import { remote } from './session/remote'
import type { SessionConfig } from './session/useSession'
import { Home } from './screens/Home'
import { Picker } from './screens/Picker'
import { Session } from './screens/Session'
import { effectiveSound, type Draft } from './types'

const idle = (fn: () => void) => {
  if ('requestIdleCallback' in window) requestIdleCallback(fn, { timeout: 2500 })
  else setTimeout(fn, 900)
}

export default function App() {
  const [prefs, setPrefs] = useState<Draft | null>(loadPrefs)
  const [cfg, setCfg] = useState<SessionConfig | null>(null)
  const [sheet, setSheet] = useState<'picker' | 'park' | 'parked' | null>(null)

  // A first visit has no stored prefs, but it still needs something to start.
  const draft = useMemo(() => prefs ?? defaults(), [prefs])
  const t = STRINGS[draft.lang]
  const label = composeLabel(draft)

  // Keep the document language honest for screen readers and hyphenation.
  useEffect(() => {
    document.documentElement.lang = draft.lang
  }, [draft.lang])

  const begin = useCallback(() => {
    const sound = effectiveSound(draft)
    const strings = STRINGS[draft.lang]
    // Must happen synchronously inside the tap: autoplay permission only exists
    // for the duration of the gesture that caused it.
    engine.start(
      sound,
      { artist: `${strings.sound[sound]} · ${strings.minutes(draft.minutes)}`, album: strings.mediaAlbum },
      remote,
    )
    setPrefs(savePrefs(draft))
    setCfg({ mode: draft.mode, sound, minutes: draft.minutes })
    setSheet(null)
  }, [draft])

  useEffect(() => {
    if (window.__laterRest) {
      // Rest was tapped before this bundle finished loading. The inline script in
      // index.html already started the bed inside that gesture, so picking the
      // session up here costs nothing.
      delete window.__laterRest
      begin()
    } else {
      idle(() => engine.warm(effectiveSound(draft)))
    }
    // Mount only: this is the hand-off from the boot shell, not an effect that
    // should re-run when prefs change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const exit = useCallback(() => {
    setCfg(null)
    setSheet(null)
  }, [])

  return (
    <I18nProvider value={t}>
      {cfg ? (
        <Session cfg={cfg} onExit={exit} onPark={() => setSheet('park')} covered={sheet !== null} />
      ) : (
        <Home
          prefs={prefs}
          draft={draft}
          label={label}
          onRest={begin}
          onPicker={() => setSheet('picker')}
          onPark={() => setSheet('park')}
          onParked={() => setSheet('parked')}
        />
      )}

      {sheet === 'picker' && (
        <Picker
          value={draft}
          onChange={(v) => {
            setPrefs(savePrefs(v))
            // Keep the next tap instant if the soundscape changed.
            idle(() => engine.warm(effectiveSound(v)))
          }}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet === 'park' && <ParkSheet onClose={() => setSheet(null)} />}
      {sheet === 'parked' && <ParkedList onClose={() => setSheet(null)} />}
    </I18nProvider>
  )
}
