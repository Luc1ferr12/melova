import { Search as SearchIcon, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Card } from '../components/Card'
import { TrackList } from '../components/TrackList'
import { groupAlbums, groupArtists, lib, playlistCover } from '../lib/library'
import { href } from '../lib/ui'
import { GENRES, searchOnline } from '../lib/online'
import { OnlineState, useOnline } from './Explore'

const TILE_COLORS = ['#7a3cff', '#e0446a', '#1f8a70', '#d9822b', '#2d6cdf', '#a23b72', '#4f7d2a', '#b5492f', '#5e4fa2', '#0f7c8c']

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

export function Search() {
  const [q, setQ] = useState(() => sessionStorage.getItem('melova.q') || '')
  const tracks = lib.use((s) => s.tracks)
  const playlists = lib.use((s) => s.playlists)
  const albums = useMemo(() => groupAlbums(tracks), [tracks])
  const artists = useMemo(() => groupArtists(tracks), [tracks])
  const set = (v: string) => {
    setQ(v)
    sessionStorage.setItem('melova.q', v)
  }
  const n = norm(q.trim())
  const has = (s: string) => norm(s).includes(n)
  const songs = n ? tracks.filter((t) => has(t.title) || has(t.artist) || has(t.album)) : []
  const fa = n ? artists.filter((a) => has(a.name)) : []
  const fal = n ? albums.filter((a) => has(a.name) || has(a.sub)) : []
  const fp = n ? playlists.filter((p) => has(p.name)) : []
  const [debounced, setDebounced] = useState(q.trim())
  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 400)
    return () => clearTimeout(t)
  }, [q])
  const online = useOnline(debounced.length >= 2 ? 'q:' + debounced : null, () => searchOnline(debounced, 20))
  const localNone = !songs.length && !fa.length && !fal.length && !fp.length

  return (
    <div className="page">
      <div className="search-box">
        <SearchIcon size={20} />
        <input
          className="search-input"
          placeholder="What do you want to play?"
          value={q}
          onChange={(e) => set(e.target.value)}
          autoFocus={!matchMedia('(hover: none)').matches}
          aria-label="Search your library"
        />
        {q && <button className="icon-btn" onClick={() => set('')} aria-label="Clear search"><X size={18} /></button>}
      </div>

      {!n && (
        <>
          <h2 className="section-title">Browse online</h2>
          <div className="browse-grid">
            {GENRES.slice(0, 10).map((g, i) => (
              <a key={g} className="browse-tile" href="#/explore" onClick={() => sessionStorage.setItem('melova.genre', g)} style={{ background: TILE_COLORS[(i + 3) % TILE_COLORS.length] }}>
                <span>{g}</span>
              </a>
            ))}
          </div>
        </>
      )}
      {!n && artists.length > 0 && (
        <>
          <h2 className="section-title">Browse your artists</h2>
          <div className="browse-grid">
            {artists.map((a, i) => (
              <a key={a.key} className="browse-tile" href={href({ name: 'artist', key: a.key })} style={{ background: TILE_COLORS[i % TILE_COLORS.length] }}>
                <span>{a.name}</span>
              </a>
            ))}
          </div>
        </>
      )}

      {n && localNone && !online.loading && !online.tracks.length && debounced === q.trim() && (
        <div className="empty small-empty">
          <h2>No results for “{q}”</h2>
          <p className="muted">Check the spelling, or try fewer words.</p>
        </div>
      )}

      {songs.length > 0 && (
        <section>
          <h2 className="section-title">Your songs</h2>
          <TrackList tracks={songs.slice(0, 50)} context={'Search · ' + q} />
        </section>
      )}
      {fa.length > 0 && (
        <section className="shelf">
          <h2 className="section-title">Artists</h2>
          <div className="grid">
            {fa.map((a) => <Card key={a.key} href={href({ name: 'artist', key: a.key })} title={a.name} sub="Artist" coverId={a.coverId} round ids={a.tracks.map((t) => t.id)} context={'Artist · ' + a.name} />)}
          </div>
        </section>
      )}
      {fal.length > 0 && (
        <section className="shelf">
          <h2 className="section-title">Albums</h2>
          <div className="grid">
            {fal.map((a) => <Card key={a.key} href={href({ name: 'album', key: a.key })} title={a.name} sub={a.sub} coverId={a.coverId} ids={a.tracks.map((t) => t.id)} context={'Album · ' + a.name} />)}
          </div>
        </section>
      )}
      {fp.length > 0 && (
        <section className="shelf">
          <h2 className="section-title">Playlists</h2>
          <div className="grid">
            {fp.map((p) => <Card key={p.id} href={href({ name: 'playlist', id: p.id })} title={p.name} sub={`${p.trackIds.length} songs`} coverId={playlistCover(p)} ids={p.trackIds} context={'Playlist · ' + p.name} />)}
          </div>
        </section>
      )}
      {debounced.length >= 2 && (online.tracks.length > 0 || online.loading || online.error) && (
        <section>
          <h2 className="section-title">Online</h2>
          <OnlineState loading={online.loading} error={online.error} empty={!online.tracks.length} retry={online.retry} />
          <TrackList tracks={online.tracks} context={'Online · ' + debounced} />
        </section>
      )}
    </div>
  )
}
