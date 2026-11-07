// Online catalogue: Audius (https://audius.org), an open music platform where
// independent artists publish full tracks. Public API, no key needed.
import type { Track } from './db'

const API = 'https://api.audius.co/v1'
const APP = 'melova'

export const GENRES = [
  'Electronic', 'Hip-Hop/Rap', 'Pop', 'R&B/Soul', 'Lo-Fi', 'Alternative', 'Rock', 'House',
  'Ambient', 'Dubstep', 'Techno', 'Trap', 'Jazz', 'Acoustic', 'Folk', 'Latin', 'Funk', 'Experimental',
]

export type TimeRange = 'week' | 'month' | 'year' | 'allTime'

interface AudiusTrack {
  id: string
  title: string
  duration: number
  genre?: string
  is_streamable?: boolean
  is_delete?: boolean
  artwork?: Record<string, string> | null
  user: { name: string; handle: string }
}

export const remoteId = (audiusId: string) => 'au:' + audiusId
export const isRemote = (t: Pick<Track, 'source'> | undefined | null) => t?.source === 'audius'
export const streamUrl = (t: Track) => `${API}/tracks/${encodeURIComponent(t.id.slice(3))}/stream?app_name=${APP}`

function toTrack(a: AudiusTrack): Track {
  const art = a.artwork?.['480x480'] || a.artwork?.['1000x1000'] || a.artwork?.['150x150'] || null
  return {
    id: remoteId(a.id),
    title: a.title,
    artist: a.user?.name || a.user?.handle || 'Unknown artist',
    album: '',
    trackNo: 0,
    duration: a.duration || 0,
    coverId: art,
    fileName: '',
    size: 0,
    addedAt: Date.now(),
    liked: false,
    playCount: 0,
    lastPlayed: 0,
    source: 'audius',
    handle: a.user?.handle,
    genre: a.genre,
  }
}

const cache = new Map<string, { at: number; data: Track[] }>()

async function get(path: string, params: Record<string, string | number | undefined>): Promise<Track[]> {
  const q = new URLSearchParams({ app_name: APP })
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') q.set(k, String(v))
  const url = `${API}${path}?${q}`
  const hit = cache.get(url)
  if (hit && Date.now() - hit.at < 5 * 60_000) return hit.data
  const res = await fetch(url)
  if (!res.ok) throw new Error('Online catalogue returned ' + res.status)
  const json = (await res.json()) as { data: AudiusTrack[] }
  const data = (json.data || []).filter((t) => t.is_streamable !== false && !t.is_delete).map(toTrack)
  cache.set(url, { at: Date.now(), data })
  return data
}

export const trending = (genre?: string, time: TimeRange = 'week', limit = 50) =>
  get('/tracks/trending', { genre, time, limit })

export const searchOnline = (query: string, limit = 30) => get('/tracks/search', { query, limit })

export const artistTracks = async (handle: string) => {
  const res = await fetch(`${API}/users/handle/${encodeURIComponent(handle)}?app_name=${APP}`)
  if (!res.ok) throw new Error('Artist not found')
  const { data } = (await res.json()) as { data: { id: string } }
  return get(`/users/${data.id}/tracks`, { limit: 50, sort: 'plays' })
}
