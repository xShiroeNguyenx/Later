/**
 * Checks the shipped bundle against the budget. Opening fast is a product
 * requirement here, not an optimisation to get to later — so it is enforced.
 *
 *   npm run build && npm run size
 */
import { gzipSync } from 'node:zlib'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, dirname, extname } from 'node:path'
import { fileURLToPath } from 'node:url'

const DIST = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist')
const JS_BUDGET_KB = 60

function walk(dir) {
  const out = []
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) out.push(...walk(p))
    else out.push(p)
  }
  return out
}

let files
try {
  files = walk(DIST)
} catch {
  console.error('No dist/ — run `npm run build` first.')
  process.exit(1)
}

const gz = (p) => gzipSync(readFileSync(p), { level: 9 }).length
const kb = (n) => (n / 1024).toFixed(1)
const rel = (p) => p.slice(DIST.length + 1).replace(/\\/g, '/')

/** Workbox and the registration shim are fetched during idle time, well after
 *  the screen is up, so they are not part of what the user waits for. */
const isIdleChunk = (p) => /workbox|pwa-register|^sw\.js$/.test(rel(p))

let jsGz = 0
let criticalGz = 0

const rows = []
for (const f of files) {
  const ext = extname(f)
  const raw = statSync(f).size
  const z = gz(f)
  if (ext === '.js') {
    jsGz += z
    if (!isIdleChunk(f)) criticalGz += z
  }
  if (ext === '.html' || ext === '.css') criticalGz += z
  if (['.js', '.css', '.html', '.webmanifest'].includes(ext)) {
    rows.push([rel(f), kb(raw), kb(z)])
  }
}

const audioRaw = files.filter((f) => extname(f) === '.m4a').reduce((s, f) => s + statSync(f).size, 0)

const w = Math.max(...rows.map((r) => r[0].length), 4)
console.log(`\n${'file'.padEnd(w)}   raw kB   gzip kB`)
for (const [n, r, z] of rows.sort((a, b) => Number(b[2]) - Number(a[2]))) {
  console.log(`${n.padEnd(w)}   ${r.padStart(6)}   ${z.padStart(7)}`)
}

const htmlGz = gz(join(DIST, 'index.html'))
console.log(`\nAll JS (gzip):          ${kb(jsGz)} kB  / budget ${JS_BUDGET_KB} kB`)
console.log(`Critical path:          ${kb(criticalGz)} kB gzip (html + css + app js)`)
console.log(`Enough to paint:        ${kb(htmlGz)} kB gzip (index.html alone — shell + all CSS)`)
console.log(`Audio, lazy + cached:   ${(audioRaw / 1024 / 1024).toFixed(2)} MB (never blocks first paint)`)

if (jsGz / 1024 > JS_BUDGET_KB) {
  console.error(`\nOVER BUDGET by ${kb(jsGz - JS_BUDGET_KB * 1024)} kB`)
  process.exit(1)
}
console.log('\nWithin budget.')
