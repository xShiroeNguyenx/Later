import { STRINGS, detectLang, isLang } from '../i18n'
import { effectiveSound, type Draft, type Prefs } from '../types'

const KEY = 'later.prefs.v1'

export const defaults = (): Draft => ({
  mode: 'calm',
  sound: 'rain',
  minutes: 20,
  lang: detectLang(),
})

/**
 * The one line under the rule on the home screen.
 *
 * Composed in the draft's own language rather than from the active context, so
 * switching language recomposes it correctly in the same tick. Mode is only named
 * when it is not the default, which is why a first visit reads exactly
 * "Rain · 20 min" — the same text the static shell in index.html prints, so
 * hydration never changes it.
 */
export function composeLabel(p: Draft): string {
  const t = STRINGS[p.lang]
  const time = t.minutes(p.minutes)
  if (p.mode === 'empty') return `${t.mode.empty} · ${time}`
  const sound = t.sound[effectiveSound(p)]
  return p.mode === 'calm' ? `${sound} · ${time}` : `${sound} · ${time} · ${t.modeSuffix[p.mode]}`
}

/** Returns null on a first visit — the caller uses that to pick the wording. */
export function loadPrefs(): Draft | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const p = JSON.parse(raw) as Partial<Prefs>
    if (!p || typeof p !== 'object') return null
    const d = defaults()
    return {
      mode: p.mode ?? d.mode,
      sound: p.sound ?? d.sound,
      minutes: p.minutes === null ? null : (p.minutes ?? d.minutes),
      lang: isLang(p.lang) ? p.lang : d.lang,
    }
  } catch {
    return null
  }
}

export function savePrefs(p: Draft): Draft {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...p, label: composeLabel(p) } satisfies Prefs))
  } catch {
    /* private mode, quota, whatever — remembering is a nicety, not a feature */
  }
  return p
}
