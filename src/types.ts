import type { Lang } from './i18n'

export type Mode = 'calm' | 'breath' | 'release' | 'rain' | 'empty'

/** `none` is a real choice, not an absence — Empty Mind depends on it. */
export type SoundId = 'rain' | 'window' | 'night' | 'drift' | 'none'

/** What actually gets stored. The label is derived, so it lives separately. */
export type Draft = {
  mode: Mode
  sound: SoundId
  /** null means "until I stop". */
  minutes: number | null
  lang: Lang
}

export type Prefs = Draft & {
  /** Pre-composed, in the stored language, so the inline boot script in
   *  index.html can print it without needing any of the label logic. */
  label: string
}

/** Empty Mind is silent by definition, whatever sound was picked before. */
export const effectiveSound = (p: { mode: Mode; sound: SoundId }): SoundId =>
  p.mode === 'empty' ? 'none' : p.sound
