/**
 * Guards the one class of bug that only shows up in production.
 *
 * GitHub Pages serves a project site from /<repo>/, so a single leftover
 * root-absolute path — "/audio/rain-base.m4a" instead of "/Later/audio/…" —
 * silently 404s there and nowhere else. Locally everything looks fine. So this
 * runs in CI against the real build output.
 *
 *   node scripts/check-base.mjs /Later/
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, dirname, extname } from 'node:path'
import { fileURLToPath } from 'node:url'

const DIST = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist')
const base = process.argv[2] || '/'

if (!base.startsWith('/') || !base.endsWith('/')) {
  console.error(`Base must start and end with a slash, got "${base}"`)
  process.exit(1)
}

function walk(dir) {
  const out = []
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) out.push(...walk(p))
    else out.push(p)
  }
  return out
}

const rel = (p) => p.slice(DIST.length + 1).replace(/\\/g, '/')
const problems = []

let files
try {
  files = walk(DIST)
} catch {
  console.error('No dist/ — run `npm run build` first.')
  process.exit(1)
}

const text = files.filter((f) => ['.html', '.js', '.webmanifest'].includes(extname(f)))

// 1. Vite's %BASE_URL% placeholders must all be gone.
for (const f of text) {
  if (readFileSync(f, 'utf8').includes('%BASE_URL%')) {
    problems.push(`${rel(f)}: an unsubstituted %BASE_URL% placeholder survived the build`)
  }
}

// 2. No root-absolute references to our own asset folders when we are not at the root.
if (base !== '/') {
  const bad = /["'(]\/(audio|icons|assets)\//g
  for (const f of text) {
    const src = readFileSync(f, 'utf8')
    const hits = [...src.matchAll(bad)].map((m) => m[0])
    if (hits.length) {
      problems.push(`${rel(f)}: root-absolute asset path(s) ${[...new Set(hits)].join(', ')} — should be prefixed with "${base}"`)
    }
  }
}

// 3. The entry script must be served from under the base.
const html = readFileSync(join(DIST, 'index.html'), 'utf8')
if (!html.includes(`src="${base}assets/`)) {
  problems.push(`index.html: no module script under "${base}assets/"`)
}
if (!html.includes(`${base}icons/apple-touch-icon.png`)) {
  problems.push(`index.html: apple-touch-icon is not under "${base}"`)
}

// 4. The generated manifest has to agree, or an installed PWA opens the wrong URL.
try {
  const mf = JSON.parse(readFileSync(join(DIST, 'manifest.webmanifest'), 'utf8'))
  if (mf.start_url !== base) problems.push(`manifest: start_url is "${mf.start_url}", expected "${base}"`)
  if (mf.scope !== base) problems.push(`manifest: scope is "${mf.scope}", expected "${base}"`)
  for (const i of mf.icons ?? []) {
    if (i.src.startsWith('/') && !i.src.startsWith(base)) {
      problems.push(`manifest: icon "${i.src}" is outside "${base}"`)
    }
  }
} catch (e) {
  problems.push(`manifest.webmanifest: ${e.message}`)
}

// 5. The service worker's navigation fallback must point at our own index.
try {
  const sw = readFileSync(join(DIST, 'sw.js'), 'utf8')
  if (!sw.includes(`${base}index.html`)) {
    problems.push(`sw.js: navigateFallback does not mention "${base}index.html" — offline reloads would miss`)
  }
} catch {
  problems.push('sw.js is missing — the PWA plugin did not run')
}

// 6. The audio and icons actually shipped.
for (const f of ['audio/rain-base.m4a', 'audio/window-rain.m4a', 'audio/night-ambience.m4a',
                 'audio/thunder-1.m4a', 'audio/thunder-2.m4a',
                 'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png',
                 'icons/apple-touch-icon.png']) {
  try {
    if (!statSync(join(DIST, f)).isFile()) throw new Error('not a file')
  } catch {
    problems.push(`missing asset: ${f}`)
  }
}

if (problems.length) {
  console.error(`\nBase check FAILED for "${base}":`)
  for (const p of problems) console.error(`  - ${p}`)
  process.exit(1)
}
console.log(`Base check passed for "${base}".`)
