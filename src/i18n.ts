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
  /** The lowercase tail of the summary line, for every mode that names itself. */
  modeSuffix: Record<Exclude<Mode, 'calm' | 'empty'>, string>
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

  // the words locked to the breathing orb in Breathe mode
  phaseIn: string
  phaseOut: string

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

  sound: { rain: 'Rain', window: 'Window rain', night: 'Night', drift: 'Soft music', none: 'Silence' },
  mode: { calm: 'Calm', breath: 'Breathe', release: 'Let go', rain: 'Rain only', empty: 'Empty Mind' },
  modeSuffix: { rain: 'rain only', breath: 'breathing', release: 'letting go' },
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

  phaseIn: 'breathe in',
  phaseOut: 'breathe out',

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

    // Breathe
    restNotSleep: "Don't try to sleep. Just let your body rest.",
    orbPace: 'Let the circle set the pace — no need to count.',
    longerOut: 'Let each breath out run a little longer.',
    bodyKnows: "The body settles on its own. You don't have to help.",

    // Let go
    settleIn: 'Settle in. There is no right way to do this.',
    softenFace: 'Let your forehead soften… then your eyes.',
    unclenchJaw: 'Unclench your jaw. Let your teeth part.',
    dropShoulders: 'Your shoulders — let them sink into the bed.',
    heavyArms: 'Your arms grow heavy, down to the fingertips.',
    softBelly: 'Let the breath come and go on its own.',
    heavyLegs: 'Your legs, heavy and warm. Your feet, letting go.',
    heldByBed: 'The bed is holding you. Nothing needs holding up.',
    restIsEnough: "You don't have to sleep. Resting is enough.",
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

  sound: { rain: 'Mưa', window: 'Mưa ngoài cửa sổ', night: 'Đêm', drift: 'Nhạc êm', none: 'Im lặng' },
  mode: { calm: 'Lắng lại', breath: 'Hít thở', release: 'Buông thư', rain: 'Chỉ có mưa', empty: 'Trống không' },
  modeSuffix: { rain: 'chỉ mưa', breath: 'hít thở', release: 'buông thư' },
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

  phaseIn: 'hít vào',
  phaseOut: 'thở ra',

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

    // Hít thở
    restNotSleep: 'Không cần cố ngủ. Chỉ cần để cơ thể được nghỉ.',
    orbPace: 'Cứ để vòng sáng giữ nhịp — không cần đếm.',
    longerOut: 'Mỗi hơi thở ra, để nó dài hơn một chút.',
    bodyKnows: 'Cơ thể tự dịu xuống. Bạn không cần làm gì thêm.',

    // Buông thư
    settleIn: 'Nằm cho thật thoải mái. Không có cách nào là sai cả.',
    softenFace: 'Thả lỏng vầng trán… rồi đến hai mắt.',
    unclenchJaw: 'Buông lỏng quai hàm. Để răng hé ra.',
    dropShoulders: 'Hai vai — cứ để chúng lún xuống giường.',
    heavyArms: 'Hai cánh tay nặng dần, đến tận đầu ngón tay.',
    softBelly: 'Để hơi thở tự đến, rồi tự đi.',
    heavyLegs: 'Hai chân nặng và ấm. Bàn chân buông hẳn ra.',
    heldByBed: 'Chiếc giường đang đỡ lấy bạn. Không cần gồng giữ gì nữa.',
    restIsEnough: 'Không cần cố ngủ. Nghỉ được là đủ rồi.',
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
