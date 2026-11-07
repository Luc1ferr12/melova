// Renders the Melova mark to PNG app icons with no dependencies (Node zlib only).
import { writeFileSync, mkdirSync } from 'node:fs'
import { deflateSync } from 'node:zlib'

const BG = [0xff, 0x6a, 0x3d]
const FG = [0x1a, 0x0b, 0x05]

// distance from point to segment
function dSeg(px, py, ax, ay, bx, by) {
  const vx = bx - ax, vy = by - ay
  const t = Math.max(0, Math.min(1, ((px - ax) * vx + (py - ay) * vy) / (vx * vx + vy * vy)))
  return Math.hypot(px - ax - t * vx, py - ay - t * vy)
}
function inRoundRect(x, y, s, r) {
  const cx = Math.max(r, Math.min(s - r, x)), cy = Math.max(r, Math.min(s - r, y))
  return Math.hypot(x - cx, y - cy) <= r
}
// in 32-unit glyph space
function inGlyph(x, y) {
  const M = [[8, 21], [8, 12.5], [12.5, 17.5], [17, 12.5], [17, 21]]
  for (let i = 0; i < M.length - 1; i++) if (dSeg(x, y, ...M[i], ...M[i + 1]) <= 1.3) return true
  if (Math.hypot(x - 22.5, y - 19) <= 2.6) return true
  if (dSeg(x, y, 25.1, 19, 25.1, 10.5) <= 1.1) return true
  return false
}

function render(size, { maskable = false, rounded = true } = {}) {
  const px = Buffer.alloc(size * size * 4)
  const SS = 4
  // maskable icons need the art inside the central 80% safe zone and a full-bleed background
  const glyphScale = maskable ? 0.72 : 1
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      let a = 0, g = 0
      for (let sy = 0; sy < SS; sy++)
        for (let sx = 0; sx < SS; sx++) {
          const fx = ((x + (sx + 0.5) / SS) / size) * 32
          const fy = ((y + (sy + 0.5) / SS) / size) * 32
          const inBg = maskable || !rounded ? true : inRoundRect(fx, fy, 32, 9)
          if (!inBg) continue
          a++
          const gx = (fx - 16) / glyphScale + 16, gy = (fy - 16) / glyphScale + 16
          if (inGlyph(gx, gy)) g++
        }
      const i = (y * size + x) * 4
      const n = SS * SS
      const t = a ? g / a : 0
      for (let c = 0; c < 3; c++) px[i + c] = Math.round(BG[c] * (1 - t) + FG[c] * t)
      px[i + 3] = Math.round((a / n) * 255)
    }
  return png(size, size, px)
}

function crc32(buf) {
  let c, crc = 0xffffffff
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    crc = (crc >>> 8) ^ c
  }
  return (crc ^ 0xffffffff) >>> 0
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
  const td = Buffer.concat([Buffer.from(type), data])
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td))
  return Buffer.concat([len, td, crc])
}
function png(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h)
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4)
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])
}

mkdirSync('public/icons', { recursive: true })
writeFileSync('public/icons/icon-192.png', render(192))
writeFileSync('public/icons/icon-512.png', render(512))
writeFileSync('public/icons/icon-maskable-512.png', render(512, { maskable: true }))
// iOS wants a square, opaque icon; it rounds the corners itself
writeFileSync('public/icons/apple-touch-icon.png', render(180, { rounded: false }))
console.log('icons written')
