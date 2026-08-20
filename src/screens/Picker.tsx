import { LANGS, useT, type Lang } from '../i18n'
import { Opts, Sheet } from './Sheet'
import type { Draft, Mode, SoundId } from '../types'

type Props = { value: Draft; onChange: (v: Draft) => void; onClose: () => void }

const TIME_KEY = (m: number | null) => (m === null ? 'open' : String(m))

/**
 * Every choice on one screen, applied the instant it is tapped. No steps, no
 * confirm, no back button — someone lying awake at 2 AM is not going to be asked
 * to configure a system.
 */
export function Picker({ value, onChange, onClose }: Props) {
  const t = useT()
  const silent = value.mode === 'empty'

  const setMode = (m: Mode) => {
    // Rain mode with no sound would be an empty room; keep the two coherent.
    const sound: SoundId = m === 'rain' && value.sound === 'none' ? 'rain' : value.sound
    onChange({ ...value, mode: m, sound })
  }

  return (
    <Sheet title={t.pickerTitle} onClose={onClose}>
      <Opts
        label={t.fieldSound}
        value={silent ? 'none' : value.sound}
        onPick={(v) => onChange({ ...value, sound: v as SoundId })}
        options={[
          { v: 'rain', label: t.sound.rain, disabled: silent },
          { v: 'window', label: t.sound.window, disabled: silent },
          { v: 'night', label: t.sound.night, disabled: silent },
          { v: 'drift', label: t.sound.drift, disabled: silent },
          { v: 'none', label: t.sound.none, disabled: silent || value.mode === 'rain' },
        ]}
      />

      <Opts
        label={t.fieldMode}
        value={value.mode}
        onPick={(v) => setMode(v as Mode)}
        options={[
          { v: 'calm', label: t.mode.calm },
          { v: 'breath', label: t.mode.breath },
          { v: 'release', label: t.mode.release },
          { v: 'rain', label: t.mode.rain },
          { v: 'empty', label: t.mode.empty },
        ]}
      />

      <Opts
        label={t.fieldTime}
        value={TIME_KEY(value.minutes)}
        onPick={(v) => onChange({ ...value, minutes: v === 'open' ? null : Number(v) })}
        options={[
          { v: '10', label: '10' },
          { v: '20', label: '20' },
          { v: '45', label: '45' },
          { v: 'open', label: t.minutes(null) },
        ]}
      />

      <Opts
        label={t.fieldLang}
        value={value.lang}
        onPick={(v) => onChange({ ...value, lang: v as Lang })}
        options={LANGS.map((l) => ({ v: l.id, label: l.label }))}
      />

      <button className="quiet" onClick={onClose}>{t.done}</button>
    </Sheet>
  )
}
