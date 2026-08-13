/**
 * Fetches the deployed site and checks that the things index.html points at
 * actually resolve.
 *
 *   node scripts/smoke.mjs https://later.techdecoded.net/
 *
 * This exists because of a real failure. check-base.mjs verifies that a build is
 * internally consistent with the base it was given — but it cannot know whether
 * that base matches where the site ends up being served. A project site built for
 * /<repo>/ and then served from a custom domain at the root returns 200 for
 * index.html and 404 for every asset. The page paints perfectly, because all of
 * its CSS is inline, and then does nothing at all: the bundle never loads, React
 * never mounts, and the static shell — whose settings line is a <span>, not a
 * button — stays on screen forever.
 *
 * So: ask the live site, not the build.
 */
const target = process.argv[2] || process.env.SMOKE_URL
if (!target) {
  console.error('Usage: node scripts/smoke.mjs <url>')
  process.exit(1)
}
const base = new URL(target.endsWith('/') ? target : `${target}/`)

const problems = []
const notes = []

const get = async (url, init) => {
  const res = await fetch(url, { redirect: 'follow', ...init })
  return res
}

/** Pages can take a little while to start serving a fresh deploy. */
async function waitForPage() {
  const deadline = Date.now() + 120_000
  for (;;) {
    try {
      const res = await get(base)
      if (res.ok) return await res.text()
      notes.push(`${base} returned ${res.status}, retrying`)
    } catch (e) {
      notes.push(`${base} not reachable yet (${e.message})`)
    }
    if (Date.now() > deadline) {
      console.error(`Gave up waiting for ${base} to serve a 200.`)
      for (const n of notes.slice(-3)) console.error(`  ${n}`)
      process.exit(1)
    }
    await new Promise((r) => setTimeout(r, 5000))
  }
}

const html = await waitForPage()
console.log(`Fetched ${base} — ${html.length} bytes`)

// The shell has to be there, or we are looking at something else entirely.
if (!html.includes('id="boot"')) problems.push('index.html has no boot shell — is this the right site?')
if (!html.includes('id="app"')) problems.push('index.html has no #app mount point')

/** Every asset the page references, and where it came from. */
const refs = []
const add = (label, raw) => {
  if (raw) refs.push({ label, url: new URL(raw, base) })
}

add('module bundle', html.match(/<script[^>]+type="module"[^>]+src="([^"]+)"/)?.[1])
add('web manifest', html.match(/<link[^>]+rel="manifest"[^>]+href="([^"]+)"/)?.[1])
add('apple touch icon', html.match(/<link[^>]+rel="apple-touch-icon"[^>]+href="([^"]+)"/)?.[1])

// The audio path is built inside the inline boot script.
const audioDir = html.match(/new Audio\('([^']*?)'\s*\+/)?.[1]
if (audioDir) add('rain bed', `${audioDir}rain-base.m4a`)
else problems.push('could not find the audio path in the inline boot script')

if (!refs.some((r) => r.label === 'module bundle')) {
  problems.push('index.html references no module bundle at all')
}

for (const { label, url } of refs) {
  // A range request keeps the audio check to a kilobyte instead of 387.
  const isMedia = url.pathname.endsWith('.m4a')
  let res
  try {
    res = await get(url, isMedia ? { headers: { Range: 'bytes=0-1023' } } : undefined)
  } catch (e) {
    problems.push(`${label}: ${url.pathname} — request failed (${e.message})`)
    continue
  }
  const okStatus = res.status === 200 || (isMedia && res.status === 206)
  if (!okStatus) {
    problems.push(`${label}: ${url.pathname} — ${res.status}`)
    continue
  }
  const type = res.headers.get('content-type') || ''
  if (label === 'module bundle' && !/javascript|ecmascript/i.test(type)) {
    problems.push(`${label}: ${url.pathname} — served as "${type}", not JavaScript`)
    continue
  }
  console.log(`  ok  ${label.padEnd(17)} ${url.pathname}`)
}

if (problems.length) {
  console.error(`\nSmoke test FAILED against ${base}:`)
  for (const p of problems) console.error(`  - ${p}`)
  const bundle = refs.find((r) => r.label === 'module bundle')
  if (bundle && problems.some((p) => p.includes('module bundle'))) {
    console.error(`
The bundle path is "${bundle.url.pathname}". If that looks like it has an extra
directory in it, the build was given the wrong BASE_PATH for where this site is
actually served — see the "Work out the base path" step in the deploy workflow.
A custom domain always serves from the root, whatever the repository is called.`)
  }
  process.exit(1)
}

console.log(`\nSmoke test passed against ${base}`)
