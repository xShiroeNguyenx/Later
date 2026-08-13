# Cutting a release

## One thing to do by hand, once

Publishing has to be switched on in the repository:
**Settings → Pages → Source → GitHub Actions**.

Until that is done the workflow builds and passes but has nowhere to deliver to.
Afterwards, every push to `main` lands at
<https://xshiroenguyenx.github.io/Later/>. The workflow works out on its own that
the site lives at `/Later/` rather than the root.

> GitHub Pages on a **private** repository needs GitHub Pro or above. On a free
> plan either keep the repository public, or deploy the same `dist/` to Cloudflare
> Pages or Vercel, which both build private repositories for free. If you do, set
> `BASE_PATH=/` since those serve from the root.

## Before every release

### Automated

CI already runs all of this on every push. To do it locally:

```bash
npm ci
npm run build                    # typecheck + build
npm run size                     # bundle budget — fails over 60 kB gzip of JS
npm run check-base               # no root-absolute paths that would 404 on Pages
npx playwright install chromium  # once
npm run test:e2e                 # 80 checks, ~5 min; serves dist/ itself
```

The suite covers both endings (the software fade, and the loop-seam ending with
iOS's read-only `volume` emulated), offline playback, the night rule, the
pre-hydration tap, reduced motion, and both languages. Screenshots of every state
land in `test-results/`; CI keeps them as an artifact for a week, which is the
quickest way to see what a failure actually looked like.

Also confirm the subpath build, since that is what actually gets published:

```bash
BASE_PATH=/Later/ npm run build && BASE_PATH=/Later/ npm run check-base
```

On Git Bash for Windows, MSYS rewrites `/Later/` into a Windows path — use
PowerShell instead: `$env:BASE_PATH='/Later/'; npm run build; npm run check-base`.

### On a physical device — the part nothing else can replace

A desktop browser has no iOS or Android audio session, so these cannot be
automated. **The first one gates the release**: if it fails, the product does not
work, whatever the test suite says.

- [ ] **Screen locked for 10 minutes.** iPhone Safari *and* Chrome on Android. Tap
      Rest, lock the phone, wait. Audio must still be playing, the lock screen must
      read "Later. · Rain · 20 min", and its pause button must work.
- [ ] **Timer accuracy with the screen off.** Set 10 minutes, lock the phone, and
      compare when the audio stops against a clock. Expect within ±24 s on iOS
      (it waits for the lull) and within a few seconds elsewhere.
- [ ] **The loop point, by ear.** Listen for five unbroken minutes. The
      measurements say the seam is continuous; ears are the actual judge.
- [ ] **Add to Home Screen** on both platforms, then open it standalone: correct
      icon, no browser chrome, no status-bar clash.
- [ ] **Cold open on real mobile data**, not a DevTools throttle.
- [ ] **Both languages on a Vietnamese phone** — set the system language to
      Vietnamese and confirm the first frame is already Vietnamese.

Record what you find in `PLAN.md` §11 so the next release starts from facts rather
than from this list again.

## Tagging

Two things must line up before you tag, and CI checks both rather than trusting
them:

- `package.json` `"version"` equals the tag without its `v`.
- `CHANGELOG.md` has a section for that version. The release notes are taken from
  it, so a missing or empty section fails the release instead of publishing one
  with nothing in it.

```bash
# 1. Bump the version and land the changelog entry
#    - package.json  "version"
#    - CHANGELOG.md  move Unreleased → the new version, dated
node scripts/changelog-section.mjs v0.1.0   # preview the notes CI will use
git add -A
git commit -m "Release v0.1.0"
git push

# 2. Tag and push the tag
git tag -a v0.1.0 -m "Later. v0.1.0"
git push origin v0.1.0
```

Pushing `main` builds, checks and deploys. Pushing the **tag** runs the same build
and end-to-end checks again and then creates the GitHub release — notes from
`CHANGELOG.md`, plus a `later-v0.1.0-static.zip` of the built site for anyone who
wants to host it themselves.

> The tag has to be pushed as its own `git push origin <tag>`. A workflow filtered
> on `branches` alone never runs for a tag, which is why `on.push.tags` is listed
> explicitly in the workflow.

### If a tag was pushed before the release job existed

Nothing ran, so nothing needs undoing beyond moving the tag:

```bash
git tag -d v0.1.0
git push origin :refs/tags/v0.1.0
git tag -a v0.1.0 -m "Later. v0.1.0"
git push origin v0.1.0
```

Safe as long as no release was ever published from it and nobody has pulled it.
Otherwise, leave it alone and cut the next version instead.

## When to call it 1.0.0

When the locked-screen test above has passed on a real iPhone and a real Android
phone, and someone other than you has actually fallen asleep to it. Not before —
that behaviour is the entire product, and every other feature is decoration on top
of it.
