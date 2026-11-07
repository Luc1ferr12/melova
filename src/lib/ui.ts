import { useEffect, useState } from 'react'
import { createStore } from './store'

/* ---------------- hash router ---------------- */
export type Route =
  | { name: 'home' }
  | { name: 'search' }
  | { name: 'library' }
  | { name: 'liked' }
  | { name: 'songs' }
  | { name: 'queue' }
  | { name: 'album'; key: string }
  | { name: 'artist'; key: string }
  | { name: 'playlist'; id: string }
  | { name: 'explore' }
  | { name: 'onlineArtist'; key: string }

function parse(hash: string): Route {
  const [, a, b] = hash.replace(/^#/, '').split('/')
  const v = b ? decodeURIComponent(b) : ''
  switch (a) {
    case 'search': return { name: 'search' }
    case 'library': return { name: 'library' }
    case 'liked': return { name: 'liked' }
    case 'songs': return { name: 'songs' }
    case 'queue': return { name: 'queue' }
    case 'album': return { name: 'album', key: v }
    case 'artist': return { name: 'artist', key: v }
    case 'playlist': return { name: 'playlist', id: v }
    case 'explore': return { name: 'explore' }
    case 'online-artist': return { name: 'onlineArtist', key: v }
    default: return { name: 'home' }
  }
}

export function href(r: Route): string {
  switch (r.name) {
    case 'album': return '#/album/' + encodeURIComponent(r.key)
    case 'artist': return '#/artist/' + encodeURIComponent(r.key)
    case 'playlist': return '#/playlist/' + encodeURIComponent(r.id)
    case 'onlineArtist': return '#/online-artist/' + encodeURIComponent(r.key)
    case 'home': return '#/'
    default: return '#/' + r.name
  }
}

export const go = (r: Route) => {
  location.hash = href(r)
}

export function useRoute() {
  const [r, setR] = useState(() => parse(location.hash))
  useEffect(() => {
    const f = () => {
      setR(parse(location.hash))
      document.querySelector('.main')?.scrollTo({ top: 0 })
    }
    window.addEventListener('hashchange', f)
    return () => window.removeEventListener('hashchange', f)
  }, [])
  return r
}

/* ---------------- toasts, overlays ---------------- */
interface UiState {
  toast: { id: number; text: string } | null
  nowPlaying: boolean
  panel: 'queue' | 'lyrics' | null // desktop side panel
}
export const ui = createStore<UiState>({ toast: null, nowPlaying: false, panel: null })

let toastTimer: number | undefined
export function toast(text: string) {
  clearTimeout(toastTimer)
  ui.set({ toast: { id: Date.now(), text } })
  toastTimer = window.setTimeout(() => ui.set({ toast: null }), 2600)
}

export function useIsMobile() {
  const q = '(max-width: 768px)'
  const [m, setM] = useState(() => matchMedia(q).matches)
  useEffect(() => {
    const mq = matchMedia(q)
    const f = () => setM(mq.matches)
    mq.addEventListener('change', f)
    return () => mq.removeEventListener('change', f)
  }, [])
  return m
}

/* ---------------- colour from cover art ---------------- */
const colorCache = new Map<string, string>()
export function useDominant(url: string | null, fallback = '#3a2a52') {
  const [c, setC] = useState(fallback)
  useEffect(() => {
    if (!url) return setC(fallback)
    if (colorCache.has(url)) return setC(colorCache.get(url)!)
    const img = new Image()
    img.crossOrigin = 'anonymous' // online artwork: needed to read pixels
    img.onload = () => {
      try {
        const cv = document.createElement('canvas')
        cv.width = cv.height = 24
        const ctx = cv.getContext('2d')!
        ctx.drawImage(img, 0, 0, 24, 24)
        const d = ctx.getImageData(0, 0, 24, 24).data
        let r = 0, g = 0, b = 0, n = 0
        for (let i = 0; i < d.length; i += 4) {
          const mx = Math.max(d[i], d[i + 1], d[i + 2])
          const mn = Math.min(d[i], d[i + 1], d[i + 2])
          const w = 1 + (mx - mn) / 32 // favour saturated pixels
          r += d[i] * w; g += d[i + 1] * w; b += d[i + 2] * w; n += w
        }
        // darken so white text always reads on it
        const k = 0.62
        const col = `rgb(${Math.round((r / n) * k)}, ${Math.round((g / n) * k)}, ${Math.round((b / n) * k)})`
        colorCache.set(url, col)
        setC(col)
      } catch {
        setC(fallback)
      }
    }
    img.src = url
  }, [url, fallback])
  return c
}

export function greeting() {
  const h = new Date().getHours()
  if (h < 5) return 'Still up?'
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

export function totalTime(sec: number) {
  const h = Math.floor(sec / 3600)
  const m = Math.round((sec % 3600) / 60)
  return h ? `${h} hr ${m} min` : `${m} min`
}
