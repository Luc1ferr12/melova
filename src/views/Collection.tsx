import { ListEnd, ListPlus, MoreHorizontal, Pause, Pencil, Play, Plus, Search, Shuffle, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Cover } from '../components/Cover'
import { askConfirm, askText, openMenu } from '../components/overlays'
import { addToPlaylistMenu, TrackList } from '../components/TrackList'
import {
  addToPlaylist,
  deletePlaylist,
  groupAlbums,
  groupArtists,
  allTracks,
  lib,
  playlistCover,
  renamePlaylist,
  useCover,
  type Track,
} from '../lib/library'
import { addToQueue, player, playList, toggle } from '../lib/player'
import { go, toast, totalTime, useDominant, type Route } from '../lib/ui'

type Sort = 'added' | 'title' | 'artist' | 'album'

interface Model {
  kind: string
  title: string
  sub: string
  coverId: string | null
  liked?: boolean
  round?: boolean
  tracks: Track[]
  context: string
  playlistId?: string
  showAlbum: boolean
  numbered: 'index' | 'trackNo'
  sortable?: boolean
}

function useModel(route: Route): Model | null {
  const tracks = lib.use((s) => s.tracks)
  const remote = lib.use((s) => s.remote)
  const playlists = lib.use((s) => s.playlists)
  return useMemo(() => {
    const every = allTracks({ tracks, remote } as Parameters<typeof allTracks>[0])
    switch (route.name) {
      case 'liked': {
        const ts = every.filter((t) => t.liked).sort((a, b) => b.addedAt - a.addedAt)
        return { kind: 'Playlist', title: 'Liked Songs', sub: '', coverId: null, liked: true, tracks: ts, context: 'Liked Songs', showAlbum: true, numbered: 'index' }
      }
      case 'songs':
        return { kind: 'On this device', title: 'All songs', sub: '', coverId: tracks[0]?.coverId ?? null, tracks, context: 'All songs', showAlbum: true, numbered: 'index', sortable: true }
      case 'album': {
        const g = groupAlbums(tracks).find((a) => a.key === route.key)
        if (!g) return null
        return { kind: 'Album', title: g.name, sub: g.sub, coverId: g.coverId, tracks: g.tracks, context: 'Album · ' + g.name, showAlbum: false, numbered: 'trackNo' }
      }
      case 'artist': {
        const g = groupArtists(tracks).find((a) => a.key === route.key)
        if (!g) return null
        return { kind: 'Artist', title: g.name, sub: '', coverId: g.coverId, round: true, tracks: g.tracks, context: 'Artist · ' + g.name, showAlbum: true, numbered: 'index' }
      }
      case 'playlist': {
        const p = playlists.find((x) => x.id === route.id)
        if (!p) return null
        const map = new Map(every.map((t) => [t.id, t]))
        const ts = p.trackIds.map((id) => map.get(id)).filter(Boolean) as Track[]
        return { kind: 'Playlist', title: p.name, sub: '', coverId: playlistCover(p), tracks: ts, context: 'Playlist · ' + p.name, playlistId: p.id, showAlbum: true, numbered: 'index' }
      }
      default:
        return null
    }
  }, [route, tracks, remote, playlists])
}

export function Collection({ route }: { route: Route }) {
  const m = useModel(route)
  const url = useCover(m?.coverId)
  const color = useDominant(url, m?.liked ? '#5b2bb5' : '#3b3b45')
  const isCtx = player.use((s) => !!m && s.context === m.context && s.queue.length > 0)
  const playing = player.use((s) => s.playing)
  const [sort, setSort] = useState<Sort>('added')
  const [adding, setAdding] = useState(false)

  if (!m)
    return (
      <div className="empty small-empty">
        <h2>Nothing here</h2>
        <p className="muted">This was deleted or moved.</p>
        <a className="btn outline" href="#/">Go home</a>
      </div>
    )

  let tracks = m.tracks
  if (m.sortable) {
    tracks = [...tracks]
    if (sort === 'added') tracks.sort((a, b) => b.addedAt - a.addedAt)
    if (sort === 'title') tracks.sort((a, b) => a.title.localeCompare(b.title))
    if (sort === 'artist') tracks.sort((a, b) => a.artist.localeCompare(b.artist) || a.album.localeCompare(b.album) || a.trackNo - b.trackNo)
    if (sort === 'album') tracks.sort((a, b) => a.album.localeCompare(b.album) || a.trackNo - b.trackNo)
  }
  const ids = tracks.map((t) => t.id)
  const dur = tracks.reduce((s, t) => s + t.duration, 0)
  const on = isCtx && playing
  const meta = [m.sub, `${tracks.length} song${tracks.length === 1 ? '' : 's'}`, tracks.length ? totalTime(dur) : ''].filter(Boolean).join(' • ')

  const more = (e: React.MouseEvent) => {
    const items = [
      { label: 'Add to queue', icon: <ListEnd size={18} />, onClick: () => { addToQueue(ids); toast('Added to queue') } },
      { label: 'Add to playlist', icon: <ListPlus size={18} />, onClick: () => addToPlaylistMenu(e, ids) },
    ]
    if (m.playlistId) {
      const pid = m.playlistId
      items.push(
        { label: 'Rename', icon: <Pencil size={18} />, onClick: async () => { const n = await askText('Rename playlist', m.title); if (n !== null) renamePlaylist(pid, n) } },
        { label: 'Delete playlist', icon: <Trash2 size={18} />, onClick: async () => { if (await askConfirm('Delete playlist?', `"${m.title}" will be deleted. The songs stay in your library.`)) { await deletePlaylist(pid); go({ name: 'library' }); toast('Playlist deleted') } } },
      )
    }
    openMenu(e, items, m.title)
  }

  return (
    <div className="page collection" style={{ ['--hero' as string]: color }}>
      <header className="hero">
        <Cover coverId={m.coverId} liked={m.liked} round={m.round} size="var(--hero-art)" className="hero-art" alt={m.title} />
        <div className="hero-text">
          <div className="small strong">{m.kind}</div>
          <h1 className={'hero-title' + (m.title.length > 24 ? ' long' : '')}>
            {m.playlistId ? (
              <button className="title-btn" onClick={async () => { const n = await askText('Rename playlist', m.title); if (n !== null) renamePlaylist(m.playlistId!, n) }} title="Rename">{m.title}</button>
            ) : m.title}
          </h1>
          <div className="hero-meta">
            {m.kind === 'Album' ? <a href={'#/artist/' + encodeURIComponent(m.sub)} className="strong">{m.sub}</a> : null}
            <span>{m.kind === 'Album' ? meta.replace(m.sub + ' • ', ' • ') : meta}</span>
          </div>
        </div>
      </header>

      <div className="actions">
        <button className="play-btn xl" disabled={!ids.length} onClick={() => (isCtx ? toggle() : playList(ids, 0, m.context))} aria-label={on ? 'Pause' : 'Play'}>
          {on ? <Pause size={26} fill="currentColor" /> : <Play size={26} fill="currentColor" className="nudge" />}
        </button>
        <button className="icon-btn big" disabled={!ids.length} onClick={() => playList(ids, 0, m.context, true)} aria-label="Shuffle play" title="Shuffle play">
          <Shuffle size={28} />
        </button>
        {m.playlistId && (
          <button className={'icon-btn big toggle' + (adding ? ' on' : '')} onClick={() => setAdding(!adding)} aria-label="Add songs" title="Add songs">
            <Plus size={28} />
          </button>
        )}
        <button className="icon-btn big" onClick={more} aria-label="More options"><MoreHorizontal size={28} /></button>
        {m.sortable && (
          <label className="sort">
            <span className="muted small">Sort</span>
            <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="select">
              <option value="added">Recently added</option>
              <option value="title">Title</option>
              <option value="artist">Artist</option>
              <option value="album">Album</option>
            </select>
          </label>
        )}
      </div>

      <div className="page-body">
        {tracks.length ? (
          <TrackList tracks={tracks} context={m.context} playlistId={m.playlistId} showAlbum={m.showAlbum} showCover={m.kind !== 'Album'} numbered={m.numbered} />
        ) : m.liked ? (
          <div className="empty small-empty"><h2>Songs you like will show up here</h2><p className="muted">Tap the heart on any song to save it.</p></div>
        ) : null}

        {m.playlistId && (adding || !tracks.length) && <AddSongs playlistId={m.playlistId} have={new Set(ids)} />}
        {m.kind === 'Artist' && <ArtistAlbums artist={m.title} />}
      </div>
    </div>
  )
}

function AddSongs({ playlistId, have }: { playlistId: string; have: Set<string> }) {
  const tracks = lib.use((s) => s.tracks)
  const [q, setQ] = useState('')
  const n = q.trim().toLowerCase()
  const list = tracks
    .filter((t) => !have.has(t.id))
    .filter((t) => !n || (t.title + ' ' + t.artist + ' ' + t.album).toLowerCase().includes(n))
    .slice(0, 30)
  return (
    <section className="add-songs">
      <h2>Let's find something for your playlist</h2>
      <div className="search-box small">
        <Search size={18} />
        <input className="search-input" placeholder="Search for songs" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search songs to add" />
      </div>
      <div className="add-list">
        {list.map((t) => (
          <div key={t.id} className="add-row">
            <Cover coverId={t.coverId} size={40} />
            <span className="tl-text"><span className="t">{t.title}</span><span className="a">{t.artist}</span></span>
            <span className="muted small hide-mobile">{t.album}</span>
            <button className="btn outline sm" onClick={() => addToPlaylist(playlistId, [t.id])}>Add</button>
          </div>
        ))}
        {!list.length && <p className="muted">{tracks.length ? 'Every song is already in this playlist.' : 'Add music to your library first.'}</p>}
      </div>
    </section>
  )
}

function ArtistAlbums({ artist }: { artist: string }) {
  const tracks = lib.use((s) => s.tracks)
  const albums = groupAlbums(tracks.filter((t) => t.artist === artist))
  if (albums.length < 1) return null
  return (
    <section className="shelf">
      <h2 className="section-title">Albums</h2>
      <div className="grid">
        {albums.map((a) => (
          <a key={a.key} className="card" href={'#/album/' + encodeURIComponent(a.key)}>
            <div className="card-art"><Cover coverId={a.coverId} size="100%" /></div>
            <div className="card-title">{a.name}</div>
            <div className="card-sub">{a.tracks.length} songs</div>
          </a>
        ))}
      </div>
    </section>
  )
}
