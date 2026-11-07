// Reads title / artist / album / track number / cover art from audio files.
// Supports ID3v2 (mp3), FLAC (Vorbis comments + PICTURE) and MP4/M4A (ilst atoms).
export interface Tags {
  title?: string
  artist?: string
  album?: string
  trackNo?: number
  cover?: Blob
}

export async function readTags(file: File): Promise<Tags> {
  try {
    const head = new Uint8Array(await file.slice(0, 12).arrayBuffer())
    const s = String.fromCharCode(...head.slice(0, 4))
    if (s.startsWith('ID3')) return await readId3(file)
    if (s === 'fLaC') return await readFlac(file)
    if (String.fromCharCode(...head.slice(4, 8)) === 'ftyp') return await readMp4(file)
  } catch (e) {
    console.warn('tag read failed', file.name, e)
  }
  return {}
}

/* ---------------- text helpers ---------------- */
function decode(bytes: Uint8Array, enc: number): string {
  let label = 'latin1'
  if (enc === 1) label = 'utf-16'
  else if (enc === 2) label = 'utf-16be'
  else if (enc === 3) label = 'utf-8'
  return new TextDecoder(label).decode(bytes).replace(/\u0000+$/g, '').replace(/^ï»¿/, '').trim()
}

function findTerminator(b: Uint8Array, start: number, enc: number): number {
  if (enc === 1 || enc === 2) {
    for (let i = start; i + 1 < b.length; i += 2) if (b[i] === 0 && b[i + 1] === 0) return i
  } else {
    for (let i = start; i < b.length; i++) if (b[i] === 0) return i
  }
  return b.length
}

function parseTrackNo(v?: string) {
  if (!v) return undefined
  const n = parseInt(v.split('/')[0], 10)
  return Number.isFinite(n) ? n : undefined
}

/* ---------------- ID3v2 ---------------- */
function syncsafe(b: Uint8Array, o: number) {
  return ((b[o] & 0x7f) << 21) | ((b[o + 1] & 0x7f) << 14) | ((b[o + 2] & 0x7f) << 7) | (b[o + 3] & 0x7f)
}

function unsync(b: Uint8Array): Uint8Array<ArrayBuffer> {
  const out: number[] = []
  for (let i = 0; i < b.length; i++) {
    out.push(b[i])
    if (b[i] === 0xff && b[i + 1] === 0x00) i++
  }
  return new Uint8Array(out)
}

async function readId3(file: File): Promise<Tags> {
  const hdr = new Uint8Array(await file.slice(0, 10).arrayBuffer())
  const ver = hdr[3]
  const flags = hdr[5]
  const size = syncsafe(hdr, 6)
  let b: Uint8Array<ArrayBuffer> = new Uint8Array(await file.slice(10, 10 + size).arrayBuffer())
  if (flags & 0x80 && ver < 4) b = unsync(b)
  let p = 0
  if (flags & 0x40) {
    // extended header
    const ext = ver === 4 ? syncsafe(b, 0) : ((b[0] << 24) | (b[1] << 16) | (b[2] << 8) | b[3]) + 4
    p = ext
  }
  const tags: Tags = {}
  const idLen = ver === 2 ? 3 : 4
  const hLen = ver === 2 ? 6 : 10
  while (p + hLen < b.length) {
    const id = String.fromCharCode(...b.slice(p, p + idLen))
    if (!/^[A-Z0-9]+$/.test(id)) break
    let fsize: number
    if (ver === 2) fsize = (b[p + 3] << 16) | (b[p + 4] << 8) | b[p + 5]
    else if (ver === 4) fsize = syncsafe(b, p + 4)
    else fsize = ((b[p + 4] << 24) | (b[p + 5] << 16) | (b[p + 6] << 8) | b[p + 7]) >>> 0
    let data: Uint8Array<ArrayBuffer> = b.slice(p + hLen, p + hLen + fsize)
    if (ver === 4 && b[p + 9] & 0x02) data = unsync(data)
    p += hLen + fsize
    if (fsize <= 0) continue
    const text = () => decode(data.slice(1), data[0])
    switch (id) {
      case 'TIT2': case 'TT2': tags.title = text(); break
      case 'TPE1': case 'TP1': tags.artist = text(); break
      case 'TALB': case 'TAL': tags.album = text(); break
      case 'TRCK': case 'TRK': tags.trackNo = parseTrackNo(text()); break
      case 'APIC': case 'PIC': {
        if (tags.cover) break
        const enc = data[0]
        let i = 1
        let mime = 'image/jpeg'
        if (id === 'PIC') {
          const fmt = String.fromCharCode(...data.slice(1, 4)).toLowerCase()
          mime = fmt === 'png' ? 'image/png' : 'image/jpeg'
          i = 4
        } else {
          const end = data.indexOf(0, i)
          mime = new TextDecoder('latin1').decode(data.slice(i, end)) || 'image/jpeg'
          if (!mime.includes('/')) mime = 'image/' + mime.toLowerCase()
          i = end + 1
        }
        i += 1 // picture type
        const dEnd = findTerminator(data, i, enc)
        i = dEnd + (enc === 1 || enc === 2 ? 2 : 1)
        tags.cover = new Blob([data.slice(i)], { type: mime })
        break
      }
    }
  }
  return tags
}

/* ---------------- FLAC ---------------- */
function vorbisComments(b: Uint8Array, tags: Tags, littleStart = 0) {
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength)
  let p = littleStart
  const vlen = dv.getUint32(p, true)
  p += 4 + vlen
  const n = dv.getUint32(p, true)
  p += 4
  const td = new TextDecoder('utf-8')
  for (let k = 0; k < n && p < b.length; k++) {
    const len = dv.getUint32(p, true)
    p += 4
    const s = td.decode(b.slice(p, p + len))
    p += len
    const eq = s.indexOf('=')
    const key = s.slice(0, eq).toUpperCase()
    const val = s.slice(eq + 1)
    if (key === 'TITLE') tags.title = val
    else if (key === 'ARTIST' && !tags.artist) tags.artist = val
    else if (key === 'ALBUM') tags.album = val
    else if (key === 'TRACKNUMBER') tags.trackNo = parseTrackNo(val)
  }
}

async function readFlac(file: File): Promise<Tags> {
  const tags: Tags = {}
  let p = 4
  for (let guard = 0; guard < 64; guard++) {
    const h = new Uint8Array(await file.slice(p, p + 4).arrayBuffer())
    if (h.length < 4) break
    const last = h[0] & 0x80
    const type = h[0] & 0x7f
    const len = (h[1] << 16) | (h[2] << 8) | h[3]
    if (type === 4 || type === 6) {
      const b = new Uint8Array(await file.slice(p + 4, p + 4 + len).arrayBuffer())
      if (type === 4) vorbisComments(b, tags)
      else if (!tags.cover) {
        const dv = new DataView(b.buffer)
        let q = 4
        const mlen = dv.getUint32(q); q += 4
        const mime = new TextDecoder().decode(b.slice(q, q + mlen)); q += mlen
        const dlen = dv.getUint32(q); q += 4 + dlen + 16
        const plen = dv.getUint32(q); q += 4
        tags.cover = new Blob([b.slice(q, q + plen)], { type: mime || 'image/jpeg' })
      }
    }
    p += 4 + len
    if (last) break
  }
  return tags
}

/* ---------------- MP4 / M4A ---------------- */
async function readMp4(file: File): Promise<Tags> {
  const tags: Tags = {}
  const readHdr = async (pos: number) => {
    const h = new DataView(await file.slice(pos, pos + 16).arrayBuffer())
    if (h.byteLength < 8) return null
    let size = h.getUint32(0)
    const type = String.fromCharCode(h.getUint8(4), h.getUint8(5), h.getUint8(6), h.getUint8(7))
    let hl = 8
    if (size === 1 && h.byteLength >= 16) { size = Number(h.getBigUint64(8)); hl = 16 }
    if (size === 0) size = file.size - pos
    return { size, type, hl }
  }
  // find moov at top level
  let pos = 0
  let moov: { start: number; end: number } | null = null
  while (pos < file.size) {
    const a = await readHdr(pos)
    if (!a || a.size < 8) break
    if (a.type === 'moov') { moov = { start: pos + a.hl, end: pos + a.size }; break }
    pos += a.size
  }
  if (!moov) return tags
  const buf = new Uint8Array(await file.slice(moov.start, moov.end).arrayBuffer())
  const dv = new DataView(buf.buffer)
  const walk = (s: number, e: number, path: string[]) => {
    let p = s
    while (p + 8 <= e) {
      const size = dv.getUint32(p)
      const type = String.fromCharCode(buf[p + 4], buf[p + 5], buf[p + 6], buf[p + 7])
      if (size < 8 || p + size > e) break
      const inner = p + 8
      if (type === 'udta' || type === 'ilst' || type === 'trak' || type === 'mdia') walk(inner, p + size, [...path, type])
      else if (type === 'meta') walk(inner + 4, p + size, [...path, type])
      else if (path[path.length - 1] === 'ilst') {
        // child contains a 'data' atom
        let q = inner
        while (q + 16 <= p + size) {
          const ds = dv.getUint32(q)
          const dt = String.fromCharCode(buf[q + 4], buf[q + 5], buf[q + 6], buf[q + 7])
          if (dt === 'data') {
            const kind = dv.getUint32(q + 8) & 0xffffff
            const payload = buf.slice(q + 16, q + ds)
            const str = () => new TextDecoder('utf-8').decode(payload)
            if (type === 'Â©nam') tags.title = str()
            else if (type === 'Â©ART' || (type === 'aART' && !tags.artist)) tags.artist = str()
            else if (type === 'Â©alb') tags.album = str()
            else if (type === 'trkn' && payload.length >= 4) tags.trackNo = (payload[2] << 8) | payload[3]
            else if (type === 'covr' && !tags.cover) tags.cover = new Blob([payload], { type: kind === 14 ? 'image/png' : 'image/jpeg' })
            break
          }
          if (ds < 8) break
          q += ds
        }
      }
      p += size
    }
  }
  walk(0, buf.length, [])
  return tags
}

/** Fallback when a file has no tags: "Artist - Title.mp3" */
export function guessFromFileName(name: string): Tags {
  const base = name.replace(/\.[^.]+$/, '').replace(/_/g, ' ').replace(/^\d+[\s.-]+/, '')
  const parts = base.split(' - ')
  if (parts.length >= 2) return { artist: parts[0].trim(), title: parts.slice(1).join(' - ').trim() }
  return { title: base.trim() }
}
