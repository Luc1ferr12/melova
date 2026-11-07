import { db } from './db'
import { coverUrl, keepRemote, lib, recordPlay, trackById } from './library'
import { streamUrl } from './online'
import { createStore } from './store'

export type Repeat = 'off' | 'all' | 'one'

interface PlayerState {
  queue: string[] // play order
  base: string[] // order before shuffle
  index: number
  playing: boolean
  shuffle: boolean
  repeat: Repeat
  time: number
  duration: number
  volume: number
  muted: boolean
  context: string // "Playlist · Road trip"
  sleepAt: number | null // epoch ms
}

const saved: Partial<PlayerState> | null = (() => {
  try {
    return JSON.parse(localStorage.getItem('melova.player') || 'null')
  } catch {
    return null
  }
})()

export const player = createStore<PlayerState>({
  queue: [],
  base: [],
  index: -1,
  shuffle: false,
  repeat: 'off',
  time: 0,
  duration: 0,
  volume: 0.9,
  muted: false,
  context: '',
  ...(saved || {}),
  playing: false,
  sleepAt: null,
})

const audio = new Audio()
audio.preload = 'auto'
let loadedId: string | null = null
let currentUrl: string | null = null
let pendingSeek = saved?.time ?? 0

audio.volume = player.get().volume
audio.muted = player.get().muted

export const currentId = () => {
  const s = player.get()
  return s.queue[s.index] ?? null
}

function persist() {
  const { queue, base, index, shuffle, repeat, time, volume, muted, context } = player.get()
  try {
    localStorage.setItem('melova.player', JSON.stringify({ queue, base, index, shuffle, repeat, time, volume, muted, context }))
  } catch {
    /* quota */
  }
}

async function load(id: string) {
  if (loadedId === id) return true
  const t = trackById(id)
  if (t?.source === 'audius') {
    if (!navigator.onLine) return false
    if (currentUrl) URL.revokeObjectURL(currentUrl)
    currentUrl = null
    loadedId = id
    audio.src = streamUrl(t)
    updateMediaSession(id)
    return true
  }
  const blob = await db.getBlob('audio', id)
  if (!blob) return false
  if (currentUrl) URL.revokeObjectURL(currentUrl)
  currentUrl = URL.createObjectURL(blob)
  loadedId = id
  audio.src = currentUrl
  updateMediaSession(id)
  return true
}

async function playCurrent(fromStart = true) {
  const id = currentId()
  if (!id) return
  const ok = await load(id)
  if (!ok) return next()
  if (fromStart) audio.currentTime = 0
  try {
    await audio.play()
    if (fromStart) recordPlay(id)
  } catch (e) {
    console.warn('play blocked', e)
    player.set({ playing: false })
  }
}

function shuffled(ids: string[], first?: string) {
  const a = ids.filter((x) => x !== first)
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return first ? [first, ...a] : a
}

/* ---------------- public controls ---------------- */
export function playList(ids: string[], start = 0, context = '', forceShuffle?: boolean) {
  if (!ids.length) return
  const shuffle = forceShuffle ?? player.get().shuffle
  const first = ids[start] ?? ids[0]
  const queue = shuffle ? shuffled(ids, forceShuffle && start === 0 ? undefined : first) : ids
  keepRemote(ids)
  player.set({ base: ids, queue, index: shuffle ? 0 : start, context, shuffle })
  loadedId = null
  playCurrent()
  persist()
}

export function toggle() {
  if (!currentId()) {
    const all = lib.get().tracks.map((t) => t.id)
    return playList(all, 0, 'All songs')
  }
  if (audio.paused) {
    if (loadedId !== currentId()) {
      load(currentId()!).then(() => {
        audio.currentTime = pendingSeek
        pendingSeek = 0
        audio.play().catch(() => {})
      })
    } else audio.play().catch(() => {})
  } else audio.pause()
}

export function next(auto = false) {
  const s = player.get()
  if (!s.queue.length) return
  if (auto && s.repeat === 'one') {
    audio.currentTime = 0
    audio.play()
    return
  }
  if (s.index + 1 < s.queue.length) player.set({ index: s.index + 1 })
  else if (s.repeat !== 'off' || !auto) player.set({ index: 0 })
  else {
    player.set({ playing: false })
    audio.pause()
    audio.currentTime = 0
    return
  }
  playCurrent()
  persist()
}

export function prev() {
  const s = player.get()
  if (audio.currentTime > 3 || s.index <= 0) {
    seek(0)
    return
  }
  player.set({ index: s.index - 1 })
  playCurrent()
  persist()
}

export function jump(i: number) {
  player.set({ index: i })
  playCurrent()
  persist()
}

export function seek(t: number) {
  if (loadedId === currentId()) audio.currentTime = t
  else pendingSeek = t
  player.set({ time: t })
}

export function setVolume(v: number) {
  audio.volume = v
  audio.muted = false
  player.set({ volume: v, muted: false })
  persist()
}

export function toggleMute() {
  audio.muted = !audio.muted
  player.set({ muted: audio.muted })
  persist()
}

export function toggleShuffle() {
  const s = player.get()
  const cur = currentId()
  if (!s.shuffle) {
    const q = shuffled(s.queue, cur ?? undefined)
    player.set({ shuffle: true, base: s.queue, queue: q, index: cur ? 0 : -1 })
  } else {
    const base = s.base.length ? s.base : s.queue
    player.set({ shuffle: false, queue: base, index: cur ? base.indexOf(cur) : -1 })
  }
  persist()
}

export function cycleRepeat() {
  const order: Repeat[] = ['off', 'all', 'one']
  player.set((s) => ({ repeat: order[(order.indexOf(s.repeat) + 1) % 3] }))
  persist()
}

export function playNext(ids: string[]) {
  keepRemote(ids)
  const s = player.get()
  if (!s.queue.length) return playList(ids, 0, 'Queue')
  const q = s.queue.filter((x, i) => i <= s.index || !ids.includes(x))
  q.splice(s.index + 1, 0, ...ids)
  player.set({ queue: q, base: [...s.base, ...ids.filter((x) => !s.base.includes(x))] })
  persist()
}

export function addToQueue(ids: string[]) {
  keepRemote(ids)
  const s = player.get()
  if (!s.queue.length) return playList(ids, 0, 'Queue')
  player.set({ queue: [...s.queue, ...ids], base: [...s.base, ...ids] })
  persist()
}

export function removeFromQueue(i: number) {
  const s = player.get()
  if (i === s.index) return
  const q = s.queue.filter((_, k) => k !== i)
  player.set({ queue: q, index: i < s.index ? s.index - 1 : s.index })
  persist()
}

/** Called when a track is deleted from the library. */
export function forget(id: string) {
  const s = player.get()
  const wasCurrent = currentId() === id
  const q = s.queue.filter((x) => x !== id)
  let index = s.index
  const pos = s.queue.indexOf(id)
  if (pos !== -1 && pos < s.index) index--
  if (index >= q.length) index = q.length - 1
  player.set({ queue: q, base: s.base.filter((x) => x !== id), index })
  if (wasCurrent) {
    audio.pause()
    loadedId = null
    if (q.length && s.playing) playCurrent()
    else player.set({ playing: false, time: 0 })
  }
  persist()
}

/* ---------------- sleep timer ---------------- */
let sleepTimer: number | undefined
export function setSleep(minutes: number | null) {
  clearTimeout(sleepTimer)
  if (!minutes) return player.set({ sleepAt: null })
  const at = Date.now() + minutes * 60_000
  player.set({ sleepAt: at })
  sleepTimer = window.setTimeout(() => {
    audio.pause()
    player.set({ sleepAt: null })
  }, minutes * 60_000)
}

/* ---------------- audio events ---------------- */
let lastSave = 0
audio.addEventListener('play', () => player.set({ playing: true }))
audio.addEventListener('pause', () => {
  player.set({ playing: false })
  persist()
})
audio.addEventListener('timeupdate', () => {
  player.set({ time: audio.currentTime })
  if (Date.now() - lastSave > 5000) {
    lastSave = Date.now()
    persist()
  }
  if ('mediaSession' in navigator && audio.duration) {
    try {
      navigator.mediaSession.setPositionState({ duration: audio.duration, position: audio.currentTime, playbackRate: 1 })
    } catch {
      /* ignore */
    }
  }
})
audio.addEventListener('durationchange', () => player.set({ duration: Number.isFinite(audio.duration) ? audio.duration : 0 }))
audio.addEventListener('ended', () => next(true))
audio.addEventListener('error', () => {
  console.warn('audio error, skipping')
  if (player.get().playing) next(true)
})

/* ---------------- media session (lock screen, headphones, keyboard media keys) ---------------- */
async function updateMediaSession(id: string) {
  if (!('mediaSession' in navigator)) return
  const t = trackById(id)
  if (!t) return
  const art = await coverUrl(t.coverId)
  navigator.mediaSession.metadata = new MediaMetadata({
    title: t.title,
    artist: t.artist,
    album: t.album,
    artwork: art ? [{ src: art, sizes: '512x512' }] : [{ src: './icons/icon-512.png', sizes: '512x512', type: 'image/png' }],
  })
  document.title = `${t.title} · ${t.artist}`
}

if ('mediaSession' in navigator) {
  const ms = navigator.mediaSession
  const h = (a: MediaSessionAction, f: MediaSessionActionHandler) => {
    try {
      ms.setActionHandler(a, f)
    } catch {
      /* unsupported */
    }
  }
  h('play', () => toggle())
  h('pause', () => audio.pause())
  h('nexttrack', () => next())
  h('previoustrack', () => prev())
  h('seekto', (d) => d.seekTime != null && seek(d.seekTime))
  h('seekbackward', () => seek(Math.max(0, audio.currentTime - 10)))
  h('seekforward', () => seek(Math.min(audio.duration || 0, audio.currentTime + 10)))
}

/** After the library loads, drop queue entries for tracks that no longer exist. */
export function reconcile() {
  const ids = new Set([...lib.get().tracks, ...lib.get().remote].map((t) => t.id))
  const s = player.get()
  const cur = s.queue[s.index]
  const queue = s.queue.filter((x) => ids.has(x))
  const index = cur && ids.has(cur) ? queue.indexOf(cur) : queue.length ? 0 : -1
  player.set({ queue, base: s.base.filter((x) => ids.has(x)), index, time: cur && ids.has(cur) ? s.time : 0 })
  if (index !== -1) {
    const t = trackById(queue[index])
    if (t) player.set({ duration: t.duration })
  }
}

export function fmt(sec: number) {
  if (!Number.isFinite(sec) || sec < 0) sec = 0
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}
