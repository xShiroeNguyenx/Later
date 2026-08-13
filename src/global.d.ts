import type { Lang } from './i18n'
import type { SoundId } from './types'

declare global {
  interface Window {
    /** Set by the inline boot script when Rest was tapped before hydration. */
    __laterRest?: 1
    /** The bed element, so a pre-hydration tap can start it inside the gesture. */
    __laterBed?: HTMLAudioElement
    __laterBedSound?: SoundId
    /** Decided by the head script in index.html, before the body is parsed. */
    __laterLang?: Lang
  }
}
