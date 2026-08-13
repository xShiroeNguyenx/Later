/**
 * Prints one version's section of CHANGELOG.md, for use as GitHub release notes.
 *
 *   node scripts/changelog-section.mjs 0.1.0
 *   node scripts/changelog-section.mjs v0.1.0     # a leading v is fine
 *
 * Exits non-zero if that version has no entry. That is deliberate: it fails the
 * release rather than quietly publishing one with empty notes.
 */
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

const raw = process.argv[2] || process.env.VERSION || ''
const version = raw.replace(/^v/, '').trim()

if (!version) {
  console.error('Usage: node scripts/changelog-section.mjs <version>')
  process.exit(1)
}

const lines = readFileSync(join(ROOT, 'CHANGELOG.md'), 'utf8').split(/\r?\n/)

// Headings look like "## [0.1.0] — 2026-08-13" or "## 0.1.0".
const isHeading = (l) => /^##\s/.test(l)
const headingVersion = (l) => l.match(/^##\s+\[?v?([0-9][^\]\s]*)\]?/)?.[1]
// Link definitions at the very bottom belong to the file, not to a section.
const isLinkDef = (l) => /^\[[^\]]+\]:\s+\S+/.test(l)

const start = lines.findIndex((l) => isHeading(l) && headingVersion(l) === version)
if (start === -1) {
  console.error(`No CHANGELOG.md section for version ${version}.`)
  console.error('Add one before tagging — the release notes come from it.')
  process.exit(1)
}

const body = []
for (let i = start + 1; i < lines.length; i++) {
  if (isHeading(lines[i]) || isLinkDef(lines[i])) break
  body.push(lines[i])
}

const text = body.join('\n').trim()
if (!text) {
  console.error(`The CHANGELOG.md section for ${version} is empty.`)
  process.exit(1)
}

console.log(text)
