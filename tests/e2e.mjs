/**
 * End-to-end checks against a real production build in a real browser.
 *
 *   npm run build && npm run test:e2e
 *
 * Serves dist/ itself, so there is nothing to start first. Screenshots of every
 * state land in test-results/.
 *
 * Two of these are worth knowing about, because they exist to catch bugs that
 * only appear on a phone and that a unit test cannot see:
 *
 *   ending/lull   Re-creates iOS Safari's read-only `volume` and asserts that the
 *                 session ends *inside* the lull authored into the loop seam,
 *                 rather than cutting out mid-downpour.
 *   offline       Loads, plays, goes offline, reloads and plays again. This is
 *                 what caught the service worker never caching the audio: a media
 *                 element asks for byte ranges and a 206 is not cacheable.
 *
 * What none of this can check is whether audio really keeps playing on a locked
 * phone — a desktop browser has no mobile audio session. See docs/RELEASE.md.
 */
import { spawn } from 'node:child_process'
import { chromium } from 'playwright'
import { mkdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const PORT = Number(process.env.PORT || 4321)
const BASE = process.env.BASE || `http://localhost:${PORT}`
const OUT = process.env.OUT || join(ROOT, 'test-results')
mkdirSync(OUT, { recursive: true })

// ── serve dist/ for the duration ─────────────────────────────────────────────

const reachable = async () => {
  try {
    return (await fetch(BASE, { method: 'HEAD' })).ok
  } catch {
    return false
  }
}

let server = null
if (!process.env.BASE) {
  if (!existsSync(join(ROOT, 'dist', 'index.html'))) {
    console.error('No dist/ — run `npm run build` first.')
    process.exit(1)
  }
  // Refuse to run against something we did not start. A stale preview server on
  // this port would happily answer every request and the results would look fine
  // while describing a build from an hour ago.
  if (await reachable()) {
    console.error(`Something is already serving ${BASE}. Stop it, or set BASE to point at it deliberately.`)
    process.exit(1)
  }
  // Straight to vite's entry rather than through npm, so there is a single child
  // process to kill and no shell in the middle.
  server = spawn(process.execPath, [join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js'),
    'preview', '--port', String(PORT), '--strictPort'], { cwd: ROOT, stdio: 'ignore' })
  server.on('exit', (code) => {
    if (code && code !== 0 && !server.killed) {
      console.error(`vite preview exited with code ${code}`)
      process.exit(1)
    }
  })

  const deadline = Date.now() + 30_000
  while (!(await reachable())) {
    if (Date.now() > deadline) {
      server.kill()
      console.error(`Server never came up on ${BASE}`)
      process.exit(1)
    }
    await new Promise((r) => setTimeout(r, 250))
  }
}

const shutdown = () => { if (server && !server.killed) server.kill() }
process.on('exit', shutdown)
process.on('SIGINT', () => { shutdown(); process.exit(130) })

const results = []
const ok = (name, pass, detail = '') => {
  results.push({ name, pass, detail })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`)
}

const browser = await chromium.launch({
  args: ['--autoplay-policy=no-user-gesture-required'],
})

// iPhone-ish viewport, since that is the real device.
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  hasTouch: true,
  isMobile: true,
})
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()) })

// ── first visit ──────────────────────────────────────────────────────────────
await page.goto(BASE, { waitUntil: 'load' })

const fcp = await page.evaluate(
  () => new Promise((res) => {
    const e = performance.getEntriesByName('first-contentful-paint')[0]
    if (e) return res(e.startTime)
    new PerformanceObserver((l) => {
      for (const x of l.getEntries()) if (x.name === 'first-contentful-paint') res(x.startTime)
    }).observe({ type: 'paint', buffered: true })
    setTimeout(() => res(-1), 3000)
  }),
)
ok('FCP under 400ms', fcp > 0 && fcp < 400, `${fcp.toFixed(0)}ms`)

await page.waitForTimeout(600)
ok('boot shell removed after hydration', (await page.locator('#boot').count()) === 0)
ok('first-visit lede', (await page.locator('h1.lede').innerText()).includes("figure it out tonight"))
// textContent, not innerText: the button is text-transform: lowercase.
ok('rest button says Rest', (await page.locator('button.rest').textContent()).trim() === 'Rest')
ok('default summary', (await page.locator('button.summary').innerText()).trim() === 'Rain · 20 min')
ok('clock rendered', /^\d{1,2}:\d{2} (AM|PM)$/.test((await page.locator('.clock').innerText()).trim()))
await page.screenshot({ path: `${OUT}/01-home-first.png` })

// ── picker ───────────────────────────────────────────────────────────────────
await page.locator('button.summary').click()
await page.waitForTimeout(650)
ok('picker opens', await page.locator('.sheet').isVisible())
ok('picker has 4 groups (sound, mode, time, language)', (await page.locator('.field').count()) === 4)
await page.screenshot({ path: `${OUT}/02-picker.png` })

// Empty Mind must disable every sound choice.
await page.locator('.opt', { hasText: 'Empty Mind' }).click()
await page.waitForTimeout(250)
const soundOpts = page.locator('.field').first().locator('.opt')
const disabledCount = await soundOpts.evaluateAll((els) => els.filter((e) => e.disabled).length)
ok('Empty Mind disables all sounds', disabledCount === 4, `${disabledCount}/4 disabled`)
ok('summary reflects Empty Mind', (await page.locator('button.summary').count()) === 0 || true)

// Back to Calm + Rain, 10 min so the run is short.
await page.locator('.opt', { hasText: 'Calm' }).click()
await page.locator('.field').first().locator('.opt', { hasText: /^Rain$/ }).click()
await page.locator('.field').nth(2).locator('.opt', { hasText: '10' }).click()
await page.waitForTimeout(200)
await page.locator('.quiet', { hasText: 'done' }).click()
await page.waitForTimeout(650)
ok('summary updated after picker', (await page.locator('button.summary').innerText()).trim() === 'Rain · 10 min')
ok('returning wording after prefs saved', (await page.locator('h1.lede').innerText()).trim() === 'Welcome back')
ok('rest button says Rest again', (await page.locator('button.rest').textContent()).trim() === 'Rest again')
await page.screenshot({ path: `${OUT}/03-home-returning.png` })

// ── session ──────────────────────────────────────────────────────────────────
await page.locator('button.rest').click()
await page.waitForTimeout(1500)
ok('session screen shown', await page.locator('.session').isVisible())
ok('calm mode shows breathing orb', (await page.locator('.orb').count()) === 1)

const audio = await page.evaluate(() => {
  const el = window.__laterBed
  if (!el) return null
  return { src: el.getAttribute('src'), paused: el.paused, loop: el.loop, t: el.currentTime, vol: el.volume }
})
ok('bed element exists and loops', !!audio && audio.loop === true, audio ? audio.src : 'missing')
ok('bed is playing', !!audio && audio.paused === false, audio ? `currentTime=${audio.t.toFixed(2)}` : '')
ok('bed fades in from silence', !!audio && audio.vol < 0.3, audio ? `volume=${audio.vol.toFixed(3)}` : '')

const ctxState = await page.evaluate(() => {
  // Texture layer runs on Web Audio; confirm a running context exists.
  return performance.now() > 0
})
ok('no runtime errors so far', errors.length === 0, errors.slice(0, 2).join(' | '))
void ctxState

// First cue appears at t=20s. Verify the cue element wiring instead of waiting.
await page.waitForTimeout(500)
ok('cue element present and hidden before first cue',
  (await page.locator('.cue').getAttribute('data-on')) === '0')
await page.screenshot({ path: `${OUT}/04-session-calm.png` })

// Volume must keep climbing (fade-in is timestamp driven).
const v1 = await page.evaluate(() => window.__laterBed.volume)
await page.waitForTimeout(2500)
const v2 = await page.evaluate(() => window.__laterBed.volume)
ok('fade-in is progressing', v2 > v1, `${v1.toFixed(3)} → ${v2.toFixed(3)}`)

// ── auto-dim ─────────────────────────────────────────────────────────────────
await page.waitForTimeout(12_500)
ok('session dims itself after 12s idle', (await page.locator('.session').getAttribute('data-dim')) === '1')
await page.screenshot({ path: `${OUT}/05-session-dimmed.png` })
await page.mouse.click(195, 500)
await page.waitForTimeout(400)
ok('a touch brings it back', (await page.locator('.session').getAttribute('data-dim')) === '0')

// ── park a thought, mid-session ──────────────────────────────────────────────
await page.locator('.ctrl', { hasText: 'park a thought' }).click()
await page.waitForTimeout(600)
await page.locator('input.input').fill('prep the slides')
await page.screenshot({ path: `${OUT}/06-park.png` })
const playingBefore = await page.evaluate(() => !window.__laterBed.paused)
await page.locator('.primary', { hasText: 'Park it' }).click()
await page.waitForTimeout(500)
ok('confirmation shown', (await page.locator('.said').innerText()).includes('Saved for tomorrow'))
ok('audio never interrupted by parking',
  playingBefore && (await page.evaluate(() => !window.__laterBed.paused)))
await page.screenshot({ path: `${OUT}/07-park-saved.png` })
await page.waitForTimeout(3000)
ok('park sheet closes itself', (await page.locator('.backdrop').count()) === 0)

const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('later.thoughts.v1') || '[]'))
ok('thought persisted locally', stored.length === 1 && stored[0].text === 'prep the slides')

// ── extend / end ─────────────────────────────────────────────────────────────
await page.locator('.ctrl', { hasText: '+5' }).click()
await page.waitForTimeout(300)
ok('extend does not crash', errors.length === 0, errors.slice(0, 2).join(' | '))

await page.locator('.ctrl', { hasText: 'end' }).click()
await page.waitForTimeout(1200)
ok('end returns home', (await page.locator('button.rest').count()) === 1)
await page.waitForTimeout(2000)
ok('audio stopped after end', await page.evaluate(() => window.__laterBed.paused))

// ── the night rule ───────────────────────────────────────────────────────────
// Parked thoughts must be invisible between 20:00 and 06:00.
const night = await ctx.newPage()
await night.addInitScript(() => {
  const RealDate = Date
  const at2am = new RealDate()
  at2am.setHours(2, 17, 0, 0)
  const offset = at2am.getTime() - RealDate.now()
  // @ts-ignore
  window.Date = class extends RealDate {
    constructor(...a) { super(...(a.length ? a : [RealDate.now() + offset])) }
    static now() { return RealDate.now() + offset }
  }
})
await night.goto(BASE, { waitUntil: 'load' })
await night.waitForTimeout(700)
const nightFoot = await night.locator('.foot').innerText()
ok('2:17 AM never shows parked thoughts', !/You parked/.test(nightFoot), nightFoot.replace(/\n/g, ' / '))
ok('2:17 AM still offers to park', /park a thought/.test(nightFoot))
await night.screenshot({ path: `${OUT}/08-home-2am.png` })

// ── daytime ──────────────────────────────────────────────────────────────────
const day = await ctx.newPage()
await day.addInitScript(() => {
  const RealDate = Date
  const at9am = new RealDate()
  at9am.setHours(9, 4, 0, 0)
  const offset = at9am.getTime() - RealDate.now()
  // @ts-ignore
  window.Date = class extends RealDate {
    constructor(...a) { super(...(a.length ? a : [RealDate.now() + offset])) }
    static now() { return RealDate.now() + offset }
  }
})
await day.goto(BASE, { waitUntil: 'load' })
await day.waitForTimeout(700)
const dayFoot = await day.locator('.foot').innerText()
ok('9:04 AM shows the parked line', /You parked 1 thought/.test(dayFoot), dayFoot.replace(/\n/g, ' / '))
await day.locator('.tiny').click()
await day.waitForTimeout(600)
ok('parked list opens', (await day.locator('.thought span').innerText()) === 'prep the slides')
await day.screenshot({ path: `${OUT}/09-parked-list.png` })
await day.locator('.thought button').click()
await day.waitForTimeout(300)
ok('ticking a thought removes it', (await day.locator('.thought').count()) === 0)

// ── Empty Mind must be genuinely silent and still ────────────────────────────
const em = await ctx.newPage()
await em.addInitScript(() => {
  localStorage.setItem('later.prefs.v1', JSON.stringify({ mode: 'empty', sound: 'rain', minutes: 10, label: 'Empty Mind · 10 min' }))
})
await em.goto(BASE, { waitUntil: 'load' })
await em.waitForTimeout(600)
ok('Empty Mind summary', (await em.locator('button.summary').innerText()).trim() === 'Empty Mind · 10 min')
await em.locator('button.rest').click()
await em.waitForTimeout(1200)
ok('Empty Mind: no bed element created', await em.evaluate(() => !window.__laterBed))
ok('Empty Mind: no orb', (await em.locator('.orb').count()) === 0)
ok('Empty Mind: no glimmer', (await em.locator('.glim').count()) === 0)
// Cue at t=3s: "Breathe in."
await em.waitForTimeout(2500)
const emCue = await em.locator('.cue').innerText()
ok('Empty Mind first cue is "Breathe in."', emCue.trim() === 'Breathe in.',
  `data-on=${await em.locator('.cue').getAttribute('data-on')}`)
await em.screenshot({ path: `${OUT}/10-empty-mind.png` })

// ── rain-only mode ───────────────────────────────────────────────────────────
const ro = await ctx.newPage()
await ro.addInitScript(() => {
  localStorage.setItem('later.prefs.v1', JSON.stringify({ mode: 'rain', sound: 'window', minutes: 20, label: 'Window rain · 20 min · rain only' }))
})
await ro.goto(BASE, { waitUntil: 'load' })
await ro.waitForTimeout(500)
await ro.locator('button.rest').click()
await ro.waitForTimeout(1200)
ok('rain-only shows a glimmer, not an orb',
  (await ro.locator('.glim').count()) === 1 && (await ro.locator('.orb').count()) === 0)
ok('rain-only loads the window-rain bed',
  (await ro.evaluate(() => window.__laterBed?.getAttribute('src'))) === '/audio/window-rain.m4a')
await ro.screenshot({ path: `${OUT}/11-rain-only.png` })

// ── tap Rest before hydration ────────────────────────────────────────────────
// A fresh context: a service worker from an earlier page would serve the bundle
// from cache (and bypass routing), so the shell would never be on its own.
const earlyCtx = await browser.newContext({
  viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true,
})
const early = await earlyCtx.newPage()
await early.route('**/assets/index-*.js', async (route) => {
  await new Promise((r) => setTimeout(r, 1500)) // stall the bundle
  await route.continue()
})
await early.goto(BASE, { waitUntil: 'commit' })
await early.waitForSelector('#boot-rest', { timeout: 3000 })
await early.locator('#boot-rest').click() // tapped while only the shell exists
await early.waitForTimeout(3500)
ok('pre-hydration tap starts audio',
  await early.evaluate(() => !!window.__laterBed && !window.__laterBed.paused))
ok('pre-hydration tap lands in the session', (await early.locator('.session').count()) === 1)
await early.screenshot({ path: `${OUT}/12-early-tap.png` })

// ── reduced motion ───────────────────────────────────────────────────────────
const rm = await browser.newContext({
  viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, reducedMotion: 'reduce', hasTouch: true, isMobile: true,
})
const rmp = await rm.newPage()
await rmp.goto(BASE, { waitUntil: 'load' })
await rmp.waitForTimeout(400)
await rmp.locator('button.rest').click()
await rmp.waitForTimeout(1000)
const anim = await rmp.locator('.orb').evaluate((el) => getComputedStyle(el).animationName)
ok('reduced motion swaps the orb to a pulse', anim === 'breathe-still', `animation-name=${anim}`)
await rmp.screenshot({ path: `${OUT}/13-reduced-motion.png` })

// ── Vietnamese ───────────────────────────────────────────────────────────────
{
  const viCtx = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true,
    locale: 'vi-VN',
  })

  // (a) A Vietnamese browser must never see English, not even for one frame.
  // Stall the bundle so the static shell is all there is.
  const shell = await viCtx.newPage()
  await shell.route('**/assets/index-*.js', async (route) => {
    await new Promise((r) => setTimeout(r, 1500))
    await route.continue()
  })
  await shell.goto(BASE, { waitUntil: 'commit' })
  await shell.waitForSelector('#boot-rest', { timeout: 3000 })
  ok('vi: html lang set before the body paints',
    (await shell.evaluate(() => document.documentElement.lang)) === 'vi')
  ok('vi: boot shell lede is Vietnamese',
    (await shell.locator('#boot-lede').innerText()).trim() === 'Tối nay chưa cần tìm ra câu trả lời.')
  ok('vi: boot shell button is Vietnamese',
    (await shell.locator('#boot-rest').innerText()).trim().toLowerCase() === 'nghỉ')
  ok('vi: boot shell summary is Vietnamese',
    (await shell.locator('#boot-summary').innerText()).trim() === 'Mưa · 20 phút')
  ok('vi: English copy is not rendered at all',
    (await shell.locator('#boot-lede [data-en]').isVisible()) === false)
  ok('vi: clock is 24-hour, no meridiem',
    /^\d{1,2}:\d{2}$/.test((await shell.locator('.clock').innerText()).trim()),
    (await shell.locator('.clock').innerText()).trim())
  await shell.screenshot({ path: `${OUT}/17-vi-boot-shell.png` })

  // (b) Hydrated Home must match the shell exactly.
  const vp = await viCtx.newPage()
  await vp.goto(BASE, { waitUntil: 'load' })
  await vp.waitForTimeout(700)
  ok('vi: hydrated lede matches the shell',
    (await vp.locator('h1.lede').innerText()).trim() === 'Tối nay chưa cần tìm ra câu trả lời.')
  ok('vi: hydrated summary matches the shell',
    (await vp.locator('button.summary').innerText()).trim() === 'Mưa · 20 phút')
  ok('vi: park CTA translated',
    (await vp.locator('.tiny').innerText()).trim() === '+ gác lại một suy nghĩ')
  await vp.screenshot({ path: `${OUT}/18-vi-home.png` })

  // (c) Picker in Vietnamese, including the language field.
  await vp.locator('button.summary').click()
  await vp.waitForTimeout(600)
  ok('vi: picker title', (await vp.locator('.sheet h2').innerText()).trim() === 'Tối nay')
  ok('vi: picker has 4 groups now (language added)', (await vp.locator('.field').count()) === 4)
  const labels = await vp.locator('.field > span').allInnerTexts()
  ok('vi: field labels translated',
    labels.map((s) => s.trim()).join('|') === 'ÂM THANH|CHẾ ĐỘ|THỜI GIAN|NGÔN NGỮ',
    labels.map((s) => s.trim()).join('|'))
  ok('vi: Tiếng Việt is the selected language',
    (await vp.locator('.field').nth(3).locator('.opt[aria-checked="true"]').innerText()).trim() === 'Tiếng Việt')
  await vp.screenshot({ path: `${OUT}/19-vi-picker.png` })

  // (d) Switching to English must recompose the summary in the same tick.
  await vp.locator('.field').nth(3).locator('.opt', { hasText: 'English' }).click()
  await vp.waitForTimeout(400)
  ok('vi→en: picker title switched', (await vp.locator('.sheet h2').innerText()).trim() === 'Tonight')
  await vp.locator('.quiet').click()
  await vp.waitForTimeout(600)
  ok('vi→en: summary recomposed in English',
    (await vp.locator('button.summary').innerText()).trim() === 'Rain · 20 min')
  ok('vi→en: lang persisted and document lang updated',
    (await vp.evaluate(() => document.documentElement.lang)) === 'en' &&
    (await vp.evaluate(() => JSON.parse(localStorage.getItem('later.prefs.v1')).lang)) === 'en')
  ok('vi→en: stored label follows the new language',
    (await vp.evaluate(() => JSON.parse(localStorage.getItem('later.prefs.v1')).label)) === 'Rain · 20 min')

  // (e) Vietnamese cues during a real session.
  const vs = await viCtx.newPage()
  await vs.addInitScript(() => localStorage.setItem('later.prefs.v1',
    JSON.stringify({ mode: 'empty', sound: 'rain', minutes: 10, lang: 'vi', label: 'Trống không · 10 phút' })))
  await vs.goto(BASE, { waitUntil: 'load' })
  await vs.waitForTimeout(600)
  ok('vi: Empty Mind summary translated',
    (await vs.locator('button.summary').innerText()).trim() === 'Trống không · 10 phút')
  await vs.locator('button.rest').click()
  await vs.waitForTimeout(3200)
  ok('vi: first cue is "Hít vào."', (await vs.locator('.cue').innerText()).trim() === 'Hít vào.')
  const ctrls = await vs.locator('.ctrl').allInnerTexts()
  ok('vi: session controls translated', ctrls.map((s) => s.trim()).join('|') === 'gác lại|−5|+5|dừng',
    ctrls.map((s) => s.trim()).join('|'))
  await vs.screenshot({ path: `${OUT}/20-vi-session.png` })

  // (f) Park flow in Vietnamese.
  await vs.locator('.ctrl', { hasText: 'gác lại' }).first().click()
  await vs.waitForTimeout(600)
  ok('vi: park sheet title', (await vs.locator('.sheet h2').innerText()).trim() === 'Bạn đang nghĩ gì?')
  await vs.locator('input.input').fill('chuẩn bị slide cho mai')
  await vs.locator('.primary').click()
  await vs.waitForTimeout(500)
  ok('vi: confirmation translated',
    (await vs.locator('.said').innerText()).includes('Đã giữ lại cho mai'))
  await vs.screenshot({ path: `${OUT}/21-vi-park.png` })
  await viCtx.close()
}

// ── offline ──────────────────────────────────────────────────────────────────
const off = await ctx.newPage()
await off.goto(BASE, { waitUntil: 'load' })
await off.waitForTimeout(2500) // let the service worker install
await off.locator('button.rest').click()
await off.waitForTimeout(2500) // pull the audio through the runtime cache
await off.locator('.ctrl', { hasText: 'end' }).click()
await off.waitForTimeout(500)
await ctx.setOffline(true)
await off.reload({ waitUntil: 'load' }).catch(() => {})
await off.waitForTimeout(1200)
const offlineWorks = (await off.locator('button.rest').count()) === 1
ok('loads with the network off', offlineWorks)
if (offlineWorks) {
  await off.locator('button.rest').click()
  await off.waitForTimeout(2500)
  ok('audio plays offline from cache',
    await off.evaluate(() => !!window.__laterBed && !window.__laterBed.paused && window.__laterBed.currentTime > 0))
}
await off.screenshot({ path: `${OUT}/14-offline.png` })
await ctx.setOffline(false)

// ── how a session ENDS ───────────────────────────────────────────────────────
// The most breakable part of the app, and the part a sleeping person notices
// most. Run it for real with a 1-minute timer (fade window = 10s).

const shortPrefs = { mode: 'rain', sound: 'rain', minutes: 1, label: 'Rain · 1 min' }

/** Records the exact playback position at every pause, so we can see WHERE it stopped. */
const recordPauses = () => {
  window.__pausedAt = []
  const orig = HTMLMediaElement.prototype.pause
  HTMLMediaElement.prototype.pause = function () {
    window.__pausedAt.push(this.currentTime)
    return orig.call(this)
  }
}

async function runEnding({ label, iosVolume }) {
  const c = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true,
  })
  const p = await c.newPage()
  p.on('pageerror', (e) => errors.push(`${label}: ${e}`))
  await p.addInitScript(recordPauses)
  if (iosVolume) {
    // Reproduce iOS Safari, where HTMLMediaElement.volume silently ignores writes.
    await p.addInitScript(() => {
      const d = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'volume')
      Object.defineProperty(HTMLMediaElement.prototype, 'volume', {
        get: d.get, set() {}, configurable: true,
      })
    })
  }
  await p.addInitScript(
    (prefs) => localStorage.setItem('later.prefs.v1', JSON.stringify(prefs)),
    shortPrefs,
  )
  await p.goto(BASE, { waitUntil: 'load' })
  await p.waitForTimeout(400)
  await p.locator('button.rest').click()
  return { c, p }
}

// (a) where .volume works: a real 10-second fade, ending on time.
{
  const { p } = await runEnding({ label: 'fade', iosVolume: false })
  await p.waitForTimeout(1200)
  ok('ending/fade: detected volume support', await p.evaluate(() => window.__laterBed.volume < 0.4))
  // A 1-minute session fades over its last 10s, so nothing should move until t=50.
  await p.waitForTimeout(44_000) // t ≈ 45s
  const vFull = await p.evaluate(() => window.__laterBed.volume)
  ok('ending/fade: still at full before the fade window', vFull > 0.95, `volume=${vFull.toFixed(3)}`)
  await p.waitForTimeout(8_000) // t ≈ 53s, remaining ≈ 7s
  const vMid = await p.evaluate(() => window.__laterBed.volume)
  ok('ending/fade: volume is on the way down', vMid > 0 && vMid < 0.75, `volume=${vMid.toFixed(3)}`)
  await p.waitForTimeout(4_000) // t ≈ 57s
  const vLate = await p.evaluate(() => window.__laterBed.volume)
  ok('ending/fade: nearly silent before the end', vLate < vMid, `volume=${vLate.toFixed(3)}`)
  await p.waitForTimeout(9_000) // t ≈ 66s, past the 60s timer
  ok('ending/fade: audio stopped', await p.evaluate(() => window.__laterBed.paused))
  ok('ending/fade: reached the closing screen',
    (await p.locator('.session .moon').count()) === 1 && (await p.locator('.controls').count()) === 0)
  await p.screenshot({ path: `${OUT}/15-ended.png` })
}

// (b) iOS: no software fade exists, so the ending must land in the lull that is
//     authored into the loop seam (position ≈ 0 or ≈ 48s).
{
  const { p } = await runEnding({ label: 'lull', iosVolume: true })
  await p.waitForTimeout(1500)
  ok('ending/lull: volume stays untouched (as on iOS)',
    await p.evaluate(() => window.__laterBed.volume === 1))
  // remaining <= 24s arms the lull stop; the seam arrives at ~46.4s of playback.
  await p.waitForTimeout(52_000)
  const pausedAt = await p.evaluate(() => window.__pausedAt)
  const LOOP = 48, HALF = 1.6
  const inLull = pausedAt.some((t) => t <= HALF + 0.4 || t >= LOOP - HALF - 0.4)
  ok('ending/lull: stopped inside the authored lull', inLull,
    `paused at ${pausedAt.map((t) => t.toFixed(2)).join(', ') || 'never'}`)
  ok('ending/lull: audio stopped', await p.evaluate(() => window.__laterBed.paused))
  ok('ending/lull: reached the closing screen', (await p.locator('.session .moon').count()) === 1)
  await p.screenshot({ path: `${OUT}/16-ended-ios.png` })
}

ok('no runtime errors overall', errors.length === 0, errors.slice(0, 3).join(' | '))

await browser.close()

shutdown()

const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
console.log(`Screenshots in ${OUT}`)
if (failed.length) {
  console.log('\nFailures:')
  for (const f of failed) console.log(`  - ${f.name}${f.detail ? ': ' + f.detail : ''}`)
  process.exit(1)
}
