import { Globe, Pause, Play, RefreshCw, Search as SearchIcon, Shuffle, WifiOff, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Cover } from '../components/Cover'
import { TrackList } from '../components/TrackList'
import { lib, seeRemote, type Track } from '../lib/library'
import { artistTracks, GENRES, searchOnline, trending, type TimeRange } from '../lib/online'
import { player, playList, toggle } from '../lib/player'
import { totalTime, useDominant, type Route } from '../lib/ui'

/** Fetch online tracks; keeps them in sync with liked / saved state. */
export function useOnline(key: string | null, load: () => Promise<Track[]>) {
  const [st, setSt] = useState<{ key: string | null; loading: boolean; error: string | null; data: Track[] }>({ key: null, loading: false, error: null, data: [] })
  const [n, setN] = useState(0)
  useEffect(() => {
    if (!key) return setSt({ key: null, loading: false, error: null, data: [] })
    let live = true
    setSt((s) => ({ key, loading: true, error: null, data: s.key === key ? s.data : [] }))
    load()
      .then((data) => live && setSt({ key, loading: false, error: null, data }))
      .catch((e) => live && setSt({ key, loading: false, error: navigator.onLine ? String(e.message || e) : 'offline', data: [] }))
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, n])
  const remote = lib.use((s) => s.remote)
  const tracks = useMemo(() => seeRemote(st.data), [st.data, remote])
  return { ...st, tracks, retry: () => setN(n + 1) }
}

export function OnlineState({ loading, error, empty, retry }: { loading: boolean; error: string | null; empty: boolean; retry: () => void }) {
  if (error)
    return (
      <div className="empty small-empty">
        {error === 'offline' ? <WifiOff size={28} /> : <Globe size={28} />}
        <h2>{error === 'offline' ? "You're offline" : "Couldn't reach the online catalogue"}</h2>
        <p className="muted">{error === 'offline' ? 'Songs on this device still play. Online music comes back when you reconnect.' : 'Check your connection and try again.'}</p>
        <button className="btn outline" onClick={retry}><RefreshCw size={16} /> Try again</button>
      </div>
    )
  if (loading && empty)
    return <div className="row-skel">{Array.from({ length: 8 }, (_, i) => <i key={i} />)}</div>
  return null
}

export function Explore() {
  const [genre, setGenre] = useState<string>(() => sessionStorage.getItem('melova.genre') || '')
  const [time, setTime] = useState<TimeRange>(() => (sessionStorage.getItem('melova.time') as TimeRange) || 'week')
  const [q, setQ] = useState('')
  const [debounced, setDebounced] = useState('')
  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 350)
    return () => clearTimeout(t)
  }, [q])
  const pickGenre = (g: string) => {
    const v = genre === g ? '' : g
    setGenre(v)
    sessionStorage.setItem('melova.genre', v)
  }
  const searching = debounced.length >= 2
  const key = searching ? 'q:' + debounced : `t:${genre}:${time}`
  const res = useOnline(key, () => (searching ? searchOnline(debounced, 40) : trending(genre || undefined, time)))
  const context = searching ? 'Online · ' + debounced : `Trending · ${genre || 'All genres'}`
  const isCtx = player.use((s) => s.context === context && s.queue.length > 0)
  const playing = player.use((s) => s.playing)
  const ids = res.tracks.map((t) => t.id)

  return (
    <div className="page explore">
      <h1 className="page-title">Explore</h1>
      <p className="muted explore-sub">
        Full songs from independent artists on Audius, streamed free. Like a song or add it to a playlist to keep it in your library.
      </p>
      <div className="search-box">
        <SearchIcon size={20} />
        <input className="search-input" placeholder="Search online music" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search online music" />
        {q && <button className="icon-btn" onClick={() => setQ('')} aria-label="Clear search"><X size={18} /></button>}
      </div>

      {!searching && (
        <>
          <div className="chips genre-chips" role="group" aria-label="Genre">
            <button className={'chip' + (!genre ? ' on' : '')} onClick={() => pickGenre('')} aria-pressed={!genre}>All</button>
            {GENRES.map((g) => (
              <button key={g} className={'chip' + (genre === g ? ' on' : '')} onClick={() => pickGenre(g)} aria-pressed={genre === g}>{g}</button>
            ))}
          </div>
        </>
      )}

      <div className="explore-head">
        <h2 className="section-title">{searching ? `Results for “${debounced}”` : `Trending ${genre ? genre : 'now'}`}</h2>
        <div className="explore-actions">
          {!searching && (
            <select className="select" value={time} onChange={(e) => { setTime(e.target.value as TimeRange); sessionStorage.setItem('melova.time', e.target.value) }} aria-label="Time range">
              <option value="week">This week</option>
              <option value="month">This month</option>
              <option value="year">This year</option>
              <option value="allTime">All time</option>
            </select>
          )}
          <button className="icon-btn big" disabled={!ids.length} onClick={() => playList(ids, 0, context, true)} aria-label="Shuffle play" title="Shuffle play"><Shuffle size={22} /></button>
          <button className="play-btn xl" disabled={!ids.length} onClick={() => (isCtx ? toggle() : playList(ids, 0, context))} aria-label={isCtx && playing ? 'Pause' : 'Play'}>
            {isCtx && playing ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" className="nudge" />}
          </button>
        </div>
      </div>

      <OnlineState loading={res.loading} error={res.error} empty={!res.tracks.length} retry={res.retry} />
      {!res.error && !res.loading && searching && !res.tracks.length && (
        <div className="empty small-empty"><h2>No online songs for “{debounced}”</h2><p className="muted">Try an artist name, a genre or a mood.</p></div>
      )}
      <TrackList tracks={res.tracks} context={context} />
    </div>
  )
}

export function OnlineArtist({ route }: { route: Extract<Route, { name: 'onlineArtist' }> }) {
  const res = useOnline('a:' + route.key, () => artistTracks(route.key))
  const first = res.tracks[0]
  const color = useDominant(first?.coverId ?? null, '#3b3b45')
  const name = first?.artist || route.key
  const context = 'Artist · ' + name
  const isCtx = player.use((s) => s.context === context && s.queue.length > 0)
  const playing = player.use((s) => s.playing)
  const ids = res.tracks.map((t) => t.id)
  const dur = res.tracks.reduce((s, t) => s + t.duration, 0)
  return (
    <div className="page collection" style={{ ['--hero' as string]: color }}>
      <header className="hero">
        <Cover coverId={first?.coverId} round size="var(--hero-art)" className="hero-art" alt={name} />
        <div className="hero-text">
          <div className="small strong"><Globe size={12} /> Online artist</div>
          <h1 className={'hero-title' + (name.length > 24 ? ' long' : '')}>{name}</h1>
          <div className="hero-meta"><span>@{route.key}{ids.length ? ` • ${ids.length} songs • ${totalTime(dur)}` : ''}</span></div>
        </div>
      </header>
      <div className="actions">
        <button className="play-btn xl" disabled={!ids.length} onClick={() => (isCtx ? toggle() : playList(ids, 0, context))} aria-label={isCtx && playing ? 'Pause' : 'Play'}>
          {isCtx && playing ? <Pause size={26} fill="currentColor" /> : <Play size={26} fill="currentColor" className="nudge" />}
        </button>
        <button className="icon-btn big" disabled={!ids.length} onClick={() => playList(ids, 0, context, true)} aria-label="Shuffle play"><Shuffle size={28} /></button>
      </div>
      <div className="page-body">
        <OnlineState loading={res.loading} error={res.error} empty={!ids.length} retry={res.retry} />
        <TrackList tracks={res.tracks} context={context} showAlbum={false} />
      </div>
    </div>
  )
}
