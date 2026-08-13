# Changelog

Notable changes to Later. Follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

Nothing yet. The next thing to happen is not a feature — it is the physical-device
testing listed in [docs/RELEASE.md](docs/RELEASE.md).

## [0.1.0] — 2026-08-13

First release. A tiny web app for nights when your mind won't stop: open it, tap
one button, and a few minutes later you can sleep.

Deliberately **0.1.0 rather than 1.0.0** — every automated check passes, but the
single most important behaviour, *audio keeps playing with the screen locked*, has
only been verified in a desktop browser with iOS's restrictions emulated. Until
that is confirmed on a real iPhone, calling this 1.0 would be overpromising.

### Added

- **One-tap rest.** No account, no configuration, no loading screen. The Rest
  button is in the static HTML and works before the JavaScript bundle arrives —
  autoplay permission only exists inside the gesture that caused it, so an inline
  script starts the audio there and the app adopts it on hydration.
- **Three modes.** *Calm* (breathing orb, five lines over six minutes, then
  silence), *Rain only* (one line, then just the sound), *Empty Mind* (no sound,
  no motion, and a three-minute stretch with nothing on screen at all).
- **Four soundscapes** — rain, window rain, night ambience, silence — all
  synthesised from scratch, with seamless 48-second loops.
- **Thought parking.** Write down what your brain is refusing to let go of; it is
  kept locally and never shown back to you at night.
- **Sleep timer** — 10, 20, 45 minutes, or until you stop — with a real fade-out.
- **Auto-dim.** After twelve seconds without a touch the whole interface fades to
  12% and gets out of the way.
- **English and Vietnamese**, detected from the browser and switchable in the one
  settings sheet. No flash of the wrong language: the static shell ships both and
  a script in `<head>` picks one before the body is parsed.
- **Installable PWA**, fully offline after the first session.
- **Lock-screen controls** via the Media Session API, including pause that freezes
  the session clock instead of letting the timer run on in silence.

### Engineering notes

- **Two audio layers, because only one survives a locked screen.** The bed is a
  plain `<audio loop>` on an AAC/M4A file, untouched by Web Audio, so iOS treats
  it as ordinary media playback. The texture layer (droplets, shimmer, distant
  thunder) runs on Web Audio and is allowed to vanish when the screen locks.
- **The fade is baked into the audio.** iOS Safari makes
  `HTMLMediaElement.volume` read-only, so there is no software fade available on
  iPhone. Each bed is generated with a lull authored into the loop seam (−6 to
  −9 dB, verified after encoding) and playback starts and stops inside it. Where
  `.volume` does work, a real fade runs instead — detected by writing to it and
  reading it back, never by sniffing the user agent.
- **The clock never counts ticks.** Background timers get throttled hard, so every
  tick recomputes from `Date.now()`. Ticks arrive from the bed's `timeupdate`
  event as well as an interval, because `timeupdate` keeps firing while the phone
  is locked.
- **Assets are generated, not sampled.** ~200 lines of DSP produce the audio and a
  hand-rolled PNG writer produces the icons, so there is no licence to track and
  no image dependency in the toolchain.
- **App JavaScript is 16.9 kB gzip** against a 60 kB budget that CI enforces;
  `index.html` alone is 4.9 kB and enough to paint. First contentful paint measures
  90–215 ms across runs, against the 400 ms budget the suite asserts.
- **80 end-to-end checks** in `tests/e2e.mjs`, run in CI against a real build in a
  real browser — including the ending under iOS's read-only `volume`, offline
  playback, the night rule, and both languages.
- CI publishes to GitHub Pages on every push to `main`, and turns a pushed tag
  into a GitHub release with notes taken from this file. It refuses to release if
  the tag disagrees with `package.json` or the version has no entry here.
- **A post-deploy smoke test** (`scripts/smoke.mjs`) fetches the live site and
  checks that the bundle, manifest, icon and audio the page points at all actually
  resolve. This is not belt-and-braces: the base path a build is given has to match
  where the site really ends up being served, and when it does not, `index.html`
  returns 200 while every asset 404s. The page then paints perfectly — all of its
  CSS is inline — and does nothing whatsoever, because the bundle never loads and
  the static shell has no working settings button. No build-time check can see
  that; only asking the deployed URL can.
- The base path is derived from `public/CNAME` when present, because a custom
  domain always serves from the root no matter what the repository is called.
- Source is ordinary React + TypeScript, aliased to `preact/compat` at build time.

### Known limitations

See [README](README.md#browser-support) for the full list. The short version:
lock-screen playback is unverified on physical devices; on iOS a timer ends within
±24 s of the requested time because it waits for the lull; the texture layer stops
when iOS backgrounds the app, by design.

[Unreleased]: https://github.com/xShiroeNguyenx/Later/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/xShiroeNguyenx/Later/releases/tag/v0.1.0
