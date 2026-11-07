// Tiny IndexedDB wrapper. Everything lives on this device.
export interface Track {
  id: string
  title: string
  artist: string
  album: string
  trackNo: number
  duration: number
  coverId: string | null
  fileName: string
  size: number
  addedAt: number
  liked: boolean
  playCount: number
  lastPlayed: number
}

export interface Playlist {
  id: string
  name: string
  trackIds: string[]
  createdAt: number
  updatedAt: number
}

const DB_NAME = 'melova'
const VERSION = 1
type StoreName = 'tracks' | 'audio' | 'covers' | 'playlists'

let dbp: Promise<IDBDatabase> | null = null

function open(): Promise<IDBDatabase> {
  if (dbp) return dbp
  dbp = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains('tracks')) db.createObjectStore('tracks', { keyPath: 'id' })
      if (!db.objectStoreNames.contains('audio')) db.createObjectStore('audio')
      if (!db.objectStoreNames.contains('covers')) db.createObjectStore('covers')
      if (!db.objectStoreNames.contains('playlists')) db.createObjectStore('playlists', { keyPath: 'id' })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbp
}

function wrap<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function store(name: StoreName, mode: IDBTransactionMode = 'readonly') {
  const db = await open()
  return db.transaction(name, mode).objectStore(name)
}

export const db = {
  async all<T>(name: 'tracks' | 'playlists'): Promise<T[]> {
    return wrap((await store(name)).getAll()) as Promise<T[]>
  },
  async put(name: 'tracks' | 'playlists', value: Track | Playlist) {
    await wrap((await store(name, 'readwrite')).put(value))
  },
  async putBlob(name: 'audio' | 'covers', key: string, blob: Blob) {
    await wrap((await store(name, 'readwrite')).put(blob, key))
  },
  async getBlob(name: 'audio' | 'covers', key: string): Promise<Blob | undefined> {
    return wrap((await store(name)).get(key)) as Promise<Blob | undefined>
  },
  async del(name: StoreName, key: string) {
    await wrap((await store(name, 'readwrite')).delete(key))
  },
}

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

export async function requestPersistence() {
  try {
    if (navigator.storage?.persist) await navigator.storage.persist()
  } catch {
    /* not supported */
  }
}
