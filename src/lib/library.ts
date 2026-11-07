import { useEffect, useState } from 'react'
import { db, uid, requestPersistence, type Playlist, type Track } from './db'
import { createStore } from './store'
import { guessFromFileName, readTags } from './tags'

export type { Track, Playlist }

interface LibState {
  tracks: Track[]
  playlists: Playlist[]
  loaded: boolean
  importing: { done: number; total: number } | null
}

export const lib = createStore<LibState>({ tracks: [], playlists: [], loaded: false, importing: null })

export const AUDIO_EXT = /\.(mp3|m4a|aac|mp4|flac|ogg|oga|opus|wav|webm|weba)$/i

export async function loadLibrary() {
  const [tracks, playlists] = await Promise.all([db.all<Track>('tracks'), db.all<Playlist>('playlists')])
  lib.set({ tracks, playlists, loaded: true })
}

export const trackById = (id: string) => lib.get().tracks.find((t) => t.id === id)

function probeDuration(blob: Blob): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob)
    const a = new Audio()
    a.preload = 'metadata'
    let settled = false
    const done = (d: number) => {
      if (settled) return
      settled = true
      URL.revokeObjectURL(url)
      resolve(Number.isFinite(d) ? d : 0)
    }
    a.onloadedmetadata = () => done(a.duration)
    a.onerror = () => done(-1) // the browser can't decode this file
    setTimeout(() => done(Number.isFinite(a.duration) && a.duration > 0 ? a.duration : 0), 8000)
    a.src = url
  })
}

/** Import audio files picked by the user. Returns how many were added. */
export async function importFiles(fileList: FileList | File[]) {
  const files = Array.from(fileList).filter((f) => AUDIO_EXT.test(f.name) || f.type.startsWith('audio/'))
  if (!files.length) return { added: 0, failed: [] as string[] }
  await requestPersistence()
  const existing = new Set(lib.get().tracks.map((t) => t.fileName + ':' + t.size))
  const coverKeys = new Map<string, string>()
  lib.get().tracks.forEach((t) => t.coverId && coverKeys.set(t.artist + '|' + t.album, t.coverId))
  lib.set({ importing: { done: 0, total: files.length } })
  let added = 0
  const failed: string[] = []
  for (const file of files) {
    try {
      if (existing.has(file.name + ':' + file.size)) continue
      const duration = await probeDuration(file)
      if (duration < 0) {
        failed.push(file.name)
        continue
      }
      const tags = { ...guessFromFileName(file.name), ...stripEmpty(await readTags(file)) }
      const id = uid()
      const artist = tags.artist || 'Unknown artist'
      const album = tags.album || 'Unknown album'
      let coverId: string | null = null
      const key = artist + '|' + album
      if (tags.cover && tags.cover.size > 100) {
        if (tags.album && coverKeys.has(key)) coverId = coverKeys.get(key)!
        else {
          coverId = 'c' + id
          await db.putBlob('covers', coverId, tags.cover)
          if (tags.album) coverKeys.set(key, coverId)
        }
      } else if (tags.album && coverKeys.has(key)) coverId = coverKeys.get(key)!
      await db.putBlob('audio', id, file)
      const track: Track = {
        id,
        title: tags.title || file.name,
        artist,
        album,
        trackNo: tags.trackNo ?? 0,
        duration,
        coverId,
        fileName: file.name,
        size: file.size,
        addedAt: Date.now() + added,
        liked: false,
        playCount: 0,
        lastPlayed: 0,
      }
      await db.put('tracks', track)
      existing.add(file.name + ':' + file.size)
      lib.set((s) => ({ tracks: [...s.tracks, track] }))
      added++
    } catch (e) {
      console.error('import failed', file.name, e)
    } finally {
      lib.set((s) => ({ importing: s.importing && { ...s.importing, done: s.importing.done + 1 } }))
    }
  }
  lib.set({ importing: null })
  return { added, failed }
}

function stripEmpty<T extends object>(o: T): Partial<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== '')) as Partial<T>
}

export async function updateTrack(id: string, patch: Partial<Track>) {
  const t = trackById(id)
  if (!t) return
  const next = { ...t, ...patch }
  lib.set((s) => ({ tracks: s.tracks.map((x) => (x.id === id ? next : x)) }))
  await db.put('tracks', next)
}

export const toggleLike = (id: string) => updateTrack(id, { liked: !trackById(id)?.liked })

export async function recordPlay(id: string) {
  const t = trackById(id)
  if (t) await updateTrack(id, { playCount: t.playCount + 1, lastPlayed: Date.now() })
}

export async function deleteTrack(id: string) {
  const t = trackById(id)
  if (!t) return
  lib.set((s) => ({
    tracks: s.tracks.filter((x) => x.id !== id),
    playlists: s.playlists.map((p) => ({ ...p, trackIds: p.trackIds.filter((x) => x !== id) })),
  }))
  await db.del('tracks', id)
  await db.del('audio', id)
  if (t.coverId && !lib.get().tracks.some((x) => x.coverId === t.coverId)) await db.del('covers', t.coverId)
  for (const p of lib.get().playlists) await db.put('playlists', p)
}

/* ---------------- playlists ---------------- */
export async function createPlaylist(name: string, trackIds: string[] = []) {
  const p: Playlist = { id: uid(), name: name.trim() || 'My playlist', trackIds, createdAt: Date.now(), updatedAt: Date.now() }
  lib.set((s) => ({ playlists: [...s.playlists, p] }))
  await db.put('playlists', p)
  return p
}

async function savePlaylist(id: string, fn: (p: Playlist) => Playlist) {
  const p = lib.get().playlists.find((x) => x.id === id)
  if (!p) return
  const next = { ...fn(p), updatedAt: Date.now() }
  lib.set((s) => ({ playlists: s.playlists.map((x) => (x.id === id ? next : x)) }))
  await db.put('playlists', next)
}

export const renamePlaylist = (id: string, name: string) => savePlaylist(id, (p) => ({ ...p, name: name.trim() || p.name }))
export const addToPlaylist = (id: string, trackIds: string[]) =>
  savePlaylist(id, (p) => ({ ...p, trackIds: [...p.trackIds, ...trackIds.filter((t) => !p.trackIds.includes(t))] }))
export const removeFromPlaylist = (id: string, trackId: string) =>
  savePlaylist(id, (p) => ({ ...p, trackIds: p.trackIds.filter((t) => t !== trackId) }))
export const movePlaylistTrack = (id: string, from: number, to: number) =>
  savePlaylist(id, (p) => {
    const ids = [...p.trackIds]
    const [x] = ids.splice(from, 1)
    ids.splice(to, 0, x)
    return { ...p, trackIds: ids }
  })

export async function deletePlaylist(id: string) {
  lib.set((s) => ({ playlists: s.playlists.filter((p) => p.id !== id) }))
  await db.del('playlists', id)
}

/* ---------------- covers ---------------- */
const coverCache = new Map<string, Promise<string | null>>()

export function coverUrl(coverId: string | null): Promise<string | null> {
  if (!coverId) return Promise.resolve(null)
  let p = coverCache.get(coverId)
  if (!p) {
    p = db.getBlob('covers', coverId).then((b) => (b ? URL.createObjectURL(b) : null))
    coverCache.set(coverId, p)
  }
  return p
}

export function useCover(coverId: string | null | undefined) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    let live = true
    setUrl(null)
    coverUrl(coverId ?? null).then((u) => live && setUrl(u))
    return () => {
      live = false
    }
  }, [coverId])
  return url
}

/* ---------------- grouping ---------------- */
export interface Group {
  key: string
  name: string
  sub: string
  coverId: string | null
  tracks: Track[]
}

export function groupAlbums(tracks: Track[]): Group[] {
  const m = new Map<string, Group>()
  for (const t of tracks) {
    const key = t.artist + '|' + t.album
    let g = m.get(key)
    if (!g) m.set(key, (g = { key, name: t.album, sub: t.artist, coverId: t.coverId, tracks: [] }))
    if (!g.coverId) g.coverId = t.coverId
    g.tracks.push(t)
  }
  for (const g of m.values()) g.tracks.sort((a, b) => a.trackNo - b.trackNo || a.title.localeCompare(b.title))
  return [...m.values()].sort((a, b) => a.name.localeCompare(b.name))
}

export function groupArtists(tracks: Track[]): Group[] {
  const m = new Map<string, Group>()
  for (const t of tracks) {
    let g = m.get(t.artist)
    if (!g) m.set(t.artist, (g = { key: t.artist, name: t.artist, sub: '', coverId: t.coverId, tracks: [] }))
    if (!g.coverId) g.coverId = t.coverId
    g.tracks.push(t)
  }
  for (const g of m.values()) {
    const albums = new Set(g.tracks.map((t) => t.album)).size
    g.sub = `${g.tracks.length} song${g.tracks.length === 1 ? '' : 's'} · ${albums} album${albums === 1 ? '' : 's'}`
    g.tracks.sort((a, b) => a.album.localeCompare(b.album) || a.trackNo - b.trackNo)
  }
  return [...m.values()].sort((a, b) => a.name.localeCompare(b.name))
}

export function playlistCover(p: Playlist): string | null {
  for (const id of p.trackIds) {
    const t = trackById(id)
    if (t?.coverId) return t.coverId
  }
  return null
}
