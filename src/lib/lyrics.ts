// Lyrics from LRCLIB (https://lrclib.net), a free open lyrics database with time-synced lines.
import { useEffect, useState } from 'react'
import { db, type Track } from './db'

export interface Line {
  time: number // seconds
  text: string
}

export interface Lyrics {
  synced: Line[] | null
  plain: string | null
  instrumental: boolean
}

interface LrcRecord {
  trackName: string
  artistName: string
  duration: number
  instrumental: boolean
  plainLyrics: string | null
  syncedLyrics: string | null
}

const API = 'https://lrclib.net/api'

export function parseLrc(lrc: string): Line[] {
  const out: Line[] = []
  for (const raw of lrc.split(/\r?\n/)) {
    const stamps = [...raw.matchAll(/\[(\d+):(\d+(?:[.:]\d+)?)\]/g)]
    if (!stamps.length) continue
    const text = raw.replace(/\[[^\]]*\]/g, '').trim()
    for (const m of stamps) out.push({ time: +m[1] * 60 + parseFloat(m[2].replace(':', '.')), text })
  }
  return out.sort((a, b) => a.time - b.time)
}

/** Strip noise that stops a lyrics match: (feat. X), [Official Video], "- Remastered 2011", file numbers. */
export function cleanTitle(title: string) {
  return title
    .replace(/\.(mp3|m4a|flac|wav|ogg|opus)$/i, '')
    .replace(/^\d{1,3}[\s.\-_]+/, '')
    .replace(/[([](?:feat|ft|with|prod|official|lyric|audio|video|visuali[sz]er|remaster|explicit|clean)[^)\]]*[)\]]/gi, '')
    .replace(/\s+-\s+(?:remaster(?:ed)?|live|radio edit|mono|stereo)\b.*$/i, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function splitArtistTitle(t: Track) {
  let artist = t.artist
  let title = cleanTitle(t.title)
  // online uploads are often titled "Artist - Song"
  const m = title.match(/^(.+?)\s+-\s+(.+)$/)
  if (m && (artist === 'Unknown artist' || t.source === 'audius')) {
    artist = m[1]
    title = m[2]
  }
  artist = artist.replace(/\s*(?:feat\.?|ft\.?|&|,|x)\s.*$/i, '').trim()
  return { artist, title }
}

function toLyrics(r: LrcRecord): Lyrics {
  return {
    synced: r.syncedLyrics ? parseLrc(r.syncedLyrics) : null,
    plain: r.plainLyrics,
    instrumental: r.instrumental,
  }
}

async function fetchLyrics(t: Track): Promise<Lyrics | null> {
  const { artist, title } = splitArtistTitle(t)
  if (!title) return null
  // 1. exact lookup
  const q = new URLSearchParams({ artist_name: artist, track_name: title })
  if (t.album && t.album !== 'Unknown album') q.set('album_name', t.album)
  if (t.duration) q.set('duration', String(Math.round(t.duration)))
  const exact = await fetch(`${API}/get?${q}`)
  if (exact.ok) return toLyrics(await exact.json())
  // 2. fuzzy search, pick the closest length
  const res = await fetch(`${API}/search?${new URLSearchParams({ q: `${artist === 'Unknown artist' ? '' : artist} ${title}`.trim() })}`)
  if (!res.ok) return null
  const list = ((await res.json()) as LrcRecord[]).filter((r) => r.syncedLyrics || r.plainLyrics || r.instrumental)
  if (!list.length) return null
  const scored = list
    .map((r) => ({ r, d: t.duration ? Math.abs(r.duration - t.duration) : 0 }))
    .filter((x) => !t.duration || x.d < 15)
    .sort((a, b) => a.d - b.d || +!!b.r.syncedLyrics - +!!a.r.syncedLyrics)
  return scored.length ? toLyrics(scored[0].r) : null
}

const mem = new Map<string, Lyrics | null>()
const inflight = new Map<string, Promise<Lyrics | null>>()

export async function getLyrics(t: Track): Promise<Lyrics | null> {
  if (mem.has(t.id)) return mem.get(t.id)!
  const cached = await db.getVal<Lyrics | { none: true; at: number }>('lyrics', t.id).catch(() => undefined)
  if (cached && !('none' in cached)) {
    mem.set(t.id, cached)
    return cached
  }
  // a "not found" result is retried after a day
  if (cached && 'none' in cached && Date.now() - cached.at < 86_400_000) return null
  if (!navigator.onLine) return null
  let p = inflight.get(t.id)
  if (!p) {
    p = fetchLyrics(t).catch(() => null)
    inflight.set(t.id, p)
  }
  const l = await p
  inflight.delete(t.id)
  mem.set(t.id, l)
  db.putVal('lyrics', t.id, l ?? { none: true, at: Date.now() }).catch(() => {})
  return l
}

export function useLyrics(t: Track | null) {
  const [state, setState] = useState<{ id: string | null; loading: boolean; lyrics: Lyrics | null }>({ id: null, loading: false, lyrics: null })
  useEffect(() => {
    if (!t) return setState({ id: null, loading: false, lyrics: null })
    let live = true
    setState({ id: t.id, loading: true, lyrics: null })
    getLyrics(t).then((lyrics) => live && setState({ id: t.id, loading: false, lyrics }))
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t?.id])
  return state
}

/** Index of the line being sung at time `sec`. */
export function activeLine(lines: Line[], sec: number) {
  let lo = 0, hi = lines.length - 1, ans = -1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (lines[mid].time <= sec + 0.25) { ans = mid; lo = mid + 1 } else hi = mid - 1
  }
  return ans
}
