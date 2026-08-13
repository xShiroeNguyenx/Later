import { createContext, useContext } from 'react'
import { daysAgo, formatClock } from './lib/clock'
import type { CueKey } from './session/scripts'
import type { Mode, SoundId } from './types'

export type Lang = 'en' | 'vi'

export const LANGS: Array<{ id: Lang; label: string }> = [
  { id: 'en', label: 'English' },
  { id: 'vi', label: 'Tiếng Việt' },
]

export type Strings = {
  // home
  ledeFirst: string
  ledeBack: string
  rest: string
  restAgain: string
  parkCta: string
  parkedLine(n: number, when: string): string

  // labels shared by the summary line and the picker
  sound: Record<SoundId, string>
  mode: Record<Mode, string>
  rainOnlySuffix: string
  minutes(m: number | null): string

  // picker
  pickerTitle: string
  fieldSound: string
  fieldMode: string
  fieldTime: string
  fieldLang: string
  done: string

  // session controls
  ctrlPark: string
  ctrlEnd: string
  ctrlResume: string
  ariaLess: string
  ariaMore: string

  // the words during a session
  cue: Record<CueKey, string>

  // parking
  parkTitle: string
  parkPlaceholder: string
  parkAction: string
  parkCancel: string
  parkedTitle: string
  savedLine1: string
  savedLine2: string
  listTitle: string
  listEmpty: string
  close: string
  ariaDone(text: string): string

  // time
  clock(d: Date): string
  relativeDay(ts: number): string

  // lock screen
  mediaAlbum: string
}

const en: Strings = {
  ledeFirst: "You don't have to figure it out tonight.",
  ledeBack: 'Welcome back',
  rest: 'Rest',
  restAgain: 'Rest again',
  parkCta: '+ park a thought',
  parkedLine: (n, when) => `You parked ${n} ${n === 1 ? 'thought' : 'thoughts'} ${when} →`,

  sound: { rain: 'Rain', window: 'Window rain', night: 'Night', none: 'Silence' },
  mode: { calm: 'Calm', rain: 'Rain only', empty: 'Empty Mind' },
  rainOnlySuffix: 'rain only',
  minutes: (m) => (m === null ? 'until I stop' : `${m} min`),

  pickerTitle: 'Tonight',
  fieldSound: 'Sound',
  fieldMode: 'Mode',
  fieldTime: 'Time',
  fieldLang: 'Language',
  done: 'done',

  ctrlPark: 'park a thought',
  ctrlEnd: 'end',
  ctrlResume: 'resume',
  ariaLess: 'five minutes less',
  ariaMore: 'five minutes more',

  cue: {
    noFiguringOut: "You don't have to figure anything out right now.",
    letSoundFill: 'Let the sound take up the space.',
    breatheSlower: 'Breathe in… and let it out, slower.',
    nothingToSolve: 'Nothing needs to be solved tonight.',
    itCanWait: 'If a thought comes back — it can wait.',
    justRain: 'Just the rain now.',
    breatheIn: 'Breathe in.',
    breatheOut: 'Breathe out.',
    notTonight: "You don't need to solve this tonight.",
    stillHere: "Still here. That's enough.",
    goodNight: 'Good night.',
  },

  parkTitle: "What's on your mind?",
  parkPlaceholder: 'prep the slides',
  parkAction: 'Park it',
  parkCancel: 'never mind',
  parkedTitle: 'Parked',
  savedLine1: 'Saved for tomorrow.',
  savedLine2: "You don't need to think about it tonight.",
  listTitle: 'You parked these',
  listEmpty: 'Nothing parked.',
  close: 'close',
  ariaDone: (text) => `Done: ${text}`,

  clock: (d) => formatClock(d, 'en'),
  relativeDay: (ts) => {
    const d = daysAgo(ts)
    if (d <= 0) return 'today'
    if (d === 1) return 'last night'
    return `${d} days ago`
  },

  mediaAlbum: "You don't have to solve everything tonight.",
}

/**
 * Vietnamese. Translated for tone rather than word-for-word — the English leans
 * on permission ("you don't have to"), and "chưa cần" carries that better than a
 * literal negation would, while also echoing the name of the app.
 */
const vi: Strings = {
  ledeFirst: 'Tối nay chưa cần tìm ra câu trả lời.',
  ledeBack: 'Chào bạn quay lại',
  rest: 'Nghỉ',
  restAgain: 'Nghỉ tiếp',
  parkCta: '+ gác lại một suy nghĩ',
  parkedLine: (n, when) => `Bạn đã gác lại ${n} điều ${when} →`,

  sound: { rain: 'Mưa', window: 'Mưa ngoài cửa sổ', night: 'Đêm', none: 'Im lặng' },
  mode: { calm: 'Lắng lại', rain: 'Chỉ có mưa', empty: 'Trống không' },
  rainOnlySuffix: 'chỉ mưa',
  minutes: (m) => (m === null ? 'đến khi tôi dừng' : `${m} phút`),

  pickerTitle: 'Tối nay',
  fieldSound: 'Âm thanh',
  fieldMode: 'Chế độ',
  fieldTime: 'Thời gian',
  fieldLang: 'Ngôn ngữ',
  done: 'xong',

  ctrlPark: 'gác lại',
  ctrlEnd: 'dừng',
  ctrlResume: 'tiếp tục',
  ariaLess: 'bớt năm phút',
  ariaMore: 'thêm năm phút',

  cue: {
    noFiguringOut: 'Ngay lúc này bạn không cần hiểu ra điều gì cả.',
    letSoundFill: 'Cứ để âm thanh chiếm hết chỗ.',
    breatheSlower: 'Hít vào… rồi thở ra, chậm hơn một chút.',
    nothingToSolve: 'Tối nay không có gì cần được giải quyết.',
    itCanWait: 'Nếu một ý nghĩ quay lại — nó đợi được.',
    justRain: 'Giờ chỉ còn tiếng mưa.',
    breatheIn: 'Hít vào.',
    breatheOut: 'Thở ra.',
    notTonight: 'Tối nay bạn không cần giải quyết chuyện này.',
    stillHere: 'Vẫn ở đây. Vậy là đủ.',
    goodNight: 'Ngủ ngon.',
  },

  parkTitle: 'Bạn đang nghĩ gì?',
  parkPlaceholder: 'chuẩn bị slide',
  parkAction: 'Gác lại',
  parkCancel: 'thôi',
  parkedTitle: 'Đã gác lại',
  savedLine1: 'Đã giữ lại cho mai.',
  savedLine2: 'Tối nay bạn không cần nghĩ đến nó nữa.',
  listTitle: 'Những điều bạn đã gác lại',
  listEmpty: 'Chưa gác lại gì.',
  close: 'đóng',
  ariaDone: (text) => `Xong: ${text}`,

  clock: (d) => formatClock(d, 'vi'),
  relativeDay: (ts) => {
    const d = daysAgo(ts)
    if (d <= 0) return 'hôm nay'
    if (d === 1) return 'tối qua'
    return `${d} ngày trước`
  },

  mediaAlbum: 'Tối nay bạn không cần giải quyết mọi thứ.',
}

export const STRINGS: Record<Lang, Strings> = { en, vi }

export const isLang = (v: unknown): v is Lang => v === 'en' || v === 'vi'

/**
 * The head script in index.html already made this call, before the body was
 * parsed — agree with it rather than deciding again, or the shell and the app
 * could disagree for a frame. The navigator branch is only a fallback.
 */
export function detectLang(): Lang {
  if (isLang(window.__laterLang)) return window.__laterLang
  const nav = navigator.languages?.[0] ?? navigator.language ?? ''
  return nav.toLowerCase().startsWith('vi') ? 'vi' : 'en'
}

const Ctx = createContext<Strings>(en)
export const I18nProvider = Ctx.Provider
export const useT = () => useContext(Ctx)
