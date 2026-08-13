# Later.

> You don't have to solve everything tonight.

A tiny web app for nights when your mind won't stop. Open it, tap one button, and
a few minutes later you can sleep.

Not a sleep tracker. Not a meditation library. Not a music player. It does one
thing: **overthinking → rest**.

No account, no database, no notifications, no analytics. Works offline. Installs
to the home screen.

---

## Run it

```bash
npm install
npm run dev -- --host      # --host so you can open it on a real phone over LAN
```

```bash
npm run build              # typecheck + production build into dist/
npm run preview            # serve dist/ — needed to test the service worker
npm run size               # bundle budget check
npm run assets             # regenerate audio + icons (rarely needed)
```

Available in **English and Vietnamese**, picked from the browser on a first visit
and switchable in the one settings sheet.

---

## Deploying

Pushing to `main` builds and publishes to GitHub Pages — see
[.github/workflows/deploy.yml](.github/workflows/deploy.yml). Enable it once, in
**Settings → Pages → Source → GitHub Actions**.

A project site is served from `/<repo>/`, not the root, so the workflow works out
the prefix and passes it as `BASE_PATH`. Every asset URL is built from it:
`%BASE_URL%` in `index.html`, `import.meta.env.BASE_URL` in
`src/audio/layers.ts`, and the generated web manifest. `scripts/check-base.mjs`
then greps the real build output for anything root-absolute that slipped through —
that class of bug 404s only on Pages and looks perfect locally, so it is worth a
CI step of its own.

To build for a subpath by hand:

```bash
BASE_PATH=/Later/ npm run build && node scripts/check-base.mjs /Later/
```

---

## How it works

### Opening fast is a feature

Someone reaching for this at 2:17 AM should not watch a spinner.

- `index.html` carries a **static shell** — the moon, the wording, the Rest
  button, and every style the app owns, inline. It paints in ~200 ms with no
  stylesheet request and no flash of unstyled text.
- A ~40-line inline script fills in the clock and the returning-user wording, and
  **starts the audio if Rest is tapped before the bundle arrives**. Autoplay
  permission only exists inside the gesture that caused it, so waiting for
  JavaScript would mean tapping into silence.
- The app then hydrates into identical markup and removes the shell. Nothing
  moves.
- App JavaScript is **~15 kB gzip** (budget: 60 kB, enforced by `npm run size`).

### Two audio layers, because only one survives a locked screen

| | what it is | when it plays |
|---|---|---|
| **Bed** | `<audio loop>` on an AAC/M4A file, untouched by Web Audio | always, including screen locked |
| **Texture** | Web Audio: droplets, shimmer, distant thunder | only while the app is in the foreground |

iOS keeps a plain media element playing all night but suspends any
`AudioContext` the moment the screen locks. So the sound that has to survive the
night lives on the element, and the texture layer — whose only job is to hide the
48-second loop point — is treated as garnish that may vanish.

**The awkward part is fading.** iOS Safari makes `HTMLMediaElement.volume`
read-only, so on iPhone there is no software fade at all. Instead each bed is
generated with a **lull authored into the loop seam** (−6 to −9 dB over ~3
seconds, verified after encoding), and playback starts and stops *inside that
lull*. The content does the fading. Where `.volume` does work, a real fade runs
instead — detected once by writing to it and reading it back, never by sniffing
the user agent.

### Two languages, no flash

The static shell ships both languages as sibling spans, and a script in `<head>`
sets `html[lang]` before the body is parsed — CSS then hides the pair that is not
wanted. So a Vietnamese reader never sees a frame of English. Doing the swap after
the shell had rendered would have been visible.

The translation is written for tone, not word-for-word. The English leans on
permission ("you don't have to"), and Vietnamese *"chưa cần"* — not yet needed —
carries that better than a literal negation, while also echoing the name of the
app. Vietnamese also gets a 24-hour clock, because that is how the time is
actually read there.

The session timeline stores cue **keys**, not sentences, so both languages are
paced identically and adding a third is a table entry rather than a code change.

### The clock never counts ticks

Background tabs get their timers throttled hard, so a session that counted
intervals would drift by minutes with the screen off. Every tick recomputes from
`Date.now()`, which makes a missed tick harmless. Ticks arrive from the bed's
`timeupdate` event as well as an interval — `timeupdate` is tied to the audio and
keeps firing while the phone is locked.

The breathing orb is a CSS animation, not `requestAnimationFrame`, for the same
reason: rAF stops dead in a background tab.

### Audio assets are synthesised, not sampled

`npm run audio` generates every sound from scratch with about 200 lines of DSP
(`scripts/dsp.mjs`). Nothing was downloaded, so there is no licence to track, and
the loops are seamless by construction: one period of noise is tiled, filtered,
and only the final period kept — by then the filters have settled into their
steady state, so tail joins head exactly.

Icons are generated the same way, by a hand-rolled PNG writer, so the toolchain
has no image dependency.

Audio is deliberately **not** precached — a first visit costs ~19 kB, not a
megabyte. The beds land in the cache the first time they play, pulled through a
plain `fetch()` because a media element's range request returns a 206 that no
cache will accept.

---

## Design rules worth not breaking

**Parked thoughts are never shown at night.** Between 20:00 and 06:00 the list
does not exist. Reading your own worries back at 2 AM restarts exactly the loop
this app is for. They surface as one faint line during the day, and only if you
tap it.

**The exhale is longer than the inhale** — 4 seconds in, 6 out. That asymmetry is
the part that actually engages the parasympathetic side; an even rhythm looks the
same and does considerably less. (4-7-8 was tried and dropped: holding for seven
seconds is unpleasant if you have never practised it, and can make an anxious
person more anxious.)

**Empty Mind is empty visually too** — no orb, no motion, no sound, and a stretch
of three minutes with nothing on screen at all. Without that it is just "Calm
with the sound off".

**No progress bar and no countdown.** Seeing "14:32 remaining" puts you back into
thinking about time.

**No streaks, no statistics, no reminders.** A streak is a pressure. This is the
one product decision most likely to get argued away later; it shouldn't be.

---

## Layout

```
index.html            static shell + the entire design system, inline
.github/workflows/
  deploy.yml          build, budget check, base check, publish to Pages
scripts/
  dsp.mjs             filters, noise, the seamless-loop trick, WAV writer
  gen-audio.mjs       synthesises the three beds and two thunder one-shots
  gen-icons.mjs       PNG encoder + crescent artwork
  size.mjs            bundle budget check
  check-base.mjs      catches root-absolute paths that would 404 on Pages
src/
  i18n.ts             every string, in English and Vietnamese
  audio/              engine (two layers), procedural texture, MediaSession
  session/            clock/state machine, cue timings by key, breathing orb
  park/               thought parking + the night rule
  screens/            Home, Session, Picker, Sheet
  lib/                clock, prefs, auto-dim
```

Source is written as ordinary React + TypeScript; `react` is aliased to
`preact/compat` at build time, which is what gets the runtime from ~48 kB to
~11 kB gzip. See the comment at the top of `vite.config.ts` to go back to real
React — no source file changes needed.

---

## Not in scope

An AI companion (worth building once real people use this — and its job would be
to help set a thought down, never to solve it), accounts, sync, sleep tracking,
statistics, reminders.
