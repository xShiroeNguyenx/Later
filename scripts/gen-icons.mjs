/**
 * Generates the PWA icons. Hand-rolled PNG writer so there is no image
 * dependency in the toolchain — the artwork is a crescent moon on the same
 * near-black the app uses, drawn with 4x4 supersampling.
 *
 *   npm run icons
 */
import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons')

// ── PNG encoder ──────────────────────────────────────────────────────────────

const CRC_TABLE = (() => {
  const t = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c
  }
  return t
})()

function crc32(buf) {
  let c = -1
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ -1) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

/** rgba: Uint8Array of size*size*4 */
function png(size, rgba) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8   // bit depth
  ihdr[9] = 6   // colour type: RGBA
  const raw = Buffer.alloc(size * (size * 4 + 1))
  for (let y = 0; y < size; y++) {
    const o = y * (size * 4 + 1)
    raw[o] = 0 // filter: none
    rgba.copy(raw, o + 1, y * size * 4, (y + 1) * size * 4)
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// ── artwork ──────────────────────────────────────────────────────────────────

const BG = [5, 7, 11]
const MOON = [255, 208, 164]
const GLOW = [255, 190, 140]

/**
 * @param size   pixel dimensions
 * @param scale  moon radius as a fraction of half the canvas (maskable needs
 *               everything inside the central 80% safe zone)
 */
function draw(size, scale) {
  const px = new Uint8Array(size * size * 4)
  const cx = size * 0.5
  const cy = size * 0.5
  const r = size * 0.5 * scale
  // The bite taken out of the disc, offset right and slightly up.
  const bx = cx + r * 0.52
  const by = cy - r * 0.20
  const br = r * 0.86
  const SS = 4 // supersampling grid

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let cover = 0
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const px_ = x + (sx + 0.5) / SS
          const py_ = y + (sy + 0.5) / SS
          const d1 = Math.hypot(px_ - cx, py_ - cy)
          const d2 = Math.hypot(px_ - bx, py_ - by)
          if (d1 <= r && d2 >= br) cover++
        }
      }
      cover /= SS * SS

      // Soft amber halo so the icon does not read as a flat sticker.
      const dg = Math.hypot(x + 0.5 - cx, y + 0.5 - cy) / (r * 1.9)
      const halo = Math.max(0, 1 - dg) ** 2.6 * 0.16

      const o = (y * size + x) * 4
      for (let c = 0; c < 3; c++) {
        const base = BG[c] + (GLOW[c] - BG[c]) * halo
        px[o + c] = Math.round(base + (MOON[c] - base) * cover)
      }
      px[o + 3] = 255
    }
  }
  return Buffer.from(px)
}

mkdirSync(OUT, { recursive: true })

const files = [
  ['icon-192.png', 192, 0.72],
  ['icon-512.png', 512, 0.72],
  ['maskable-512.png', 512, 0.52], // smaller: survives circular / squircle masks
  ['apple-touch-icon.png', 180, 0.72],
]

console.log('Generating icons…')
for (const [name, size, scale] of files) {
  const p = join(OUT, name)
  writeFileSync(p, png(size, draw(size, scale)))
  console.log(`  ${name.padEnd(22)} ${size}x${size}  ${(statSync(p).size / 1024).toFixed(1)} KB`)
}
console.log('Done.')
