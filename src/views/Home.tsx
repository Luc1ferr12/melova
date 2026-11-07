import { Compass, FolderOpen, Music4, Upload } from 'lucide-react'
import { Card, Shelf } from '../components/Card'
import { Cover } from '../components/Cover'
import { pickFiles, pickFolder } from '../components/Shell'
import { groupAlbums, groupArtists, lib, playlistCover } from '../lib/library'
import { player, playList, toggle } from '../lib/player'
import { greeting, href } from '../lib/ui'
import { Pause, Play } from 'lucide-react'
import { trending } from '../lib/online'
import { useOnline } from './Explore'
import type { Track } from '../lib/db'

export function EmptyLibrary() {
  return (
    <div className="empty">
      <div className="empty-icon"><Music4 size={40} /></div>
      <h1>Your music, your app</h1>
      <p className="muted">
        Add songs from this device. They are kept inside Melova, so they play offline, and nothing is uploaded anywhere.
      </p>
      <div className="empty-actions">
        <button className="btn primary lg" onClick={pickFiles}><Upload size={18} /> Add music files</button>
        <button className="btn outline lg hide-touch" onClick={pickFolder}><FolderOpen size={18} /> Add a folder</button>
        <a className="btn outline lg" href="#/explore"><Compass size={18} /> Explore music online</a>
      </div>
      <p className="muted small">MP3, M4A, FLAC, OGG, Opus and WAV. You can also drop files anywhere on this window.</p>
    </div>
  )
}

function Quick({ hrefTo, title, coverId, liked, ids, context }: { hrefTo: string; title: string; coverId?: string | null; liked?: boolean; ids: string[]; context: string }) {
  const isCtx = player.use((s) => s.context === context && s.queue.length > 0)
  const playing = player.use((s) => s.playing)
  const on = isCtx && playing
  return (
    <a className="quick" href={hrefTo}>
      <Cover coverId={coverId} liked={liked} size={56} />
      <span className="quick-title">{title}</span>
      {ids.length > 0 && (
        <button
          className={'card-play small' + (on ? ' show' : '')}
          aria-label={(on ? 'Pause ' : 'Play ') + title}
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            if (isCtx) toggle()
            else playList(ids, 0, context)
          }}
        >
          {on ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="nudge" />}
        </button>
      )}
    </a>
  )
}

function TrackCard({ t, list, i, context }: { t: Track; list: string[]; i: number; context: string }) {
  const cur = player.use((s) => s.queue[s.index] === t.id)
  const playing = player.use((s) => s.playing)
  const on = cur && playing
  return (
    <button className="card" onClick={() => (cur ? toggle() : playList(list, i, context))}>
      <div className="card-art">
        <Cover coverId={t.coverId} size="100%" alt="" />
        <span className={'card-play' + (on ? ' show' : '')} aria-hidden>
          {on ? <Pause size={22} fill="currentColor" /> : <Play size={22} fill="currentColor" className="nudge" />}
        </span>
      </div>
      <div className="card-title">{t.title}</div>
      <div className="card-sub">{t.artist}</div>
    </button>
  )
}

function TrendingShelf() {
  const res = useOnline('t::week', () => trending(undefined, 'week'))
  if (res.error || (!res.loading && !res.tracks.length)) return null
  const ids = res.tracks.map((t) => t.id)
  return (
    <Shelf title="Trending online" href="#/explore">
      {res.loading && !ids.length
        ? Array.from({ length: 6 }, (_, i) => <div key={i} className="card"><div className="card-art skel-art" /></div>)
        : res.tracks.slice(0, 15).map((t, i) => <TrackCard key={t.id} t={t} list={ids} i={i} context="Trending · All genres" />)}
    </Shelf>
  )
}

export function Home() {
  const tracks = lib.use((s) => s.tracks)
  const playlists = lib.use((s) => s.playlists)
  const remoteLiked = lib.use((s) => s.remote.filter((t) => t.liked).length)
  if (!tracks.length && !playlists.length && !remoteLiked)
    return (
      <>
        <EmptyLibrary />
        <div className="page" style={{ minHeight: 0 }}><TrendingShelf /></div>
      </>
    )

  const albums = groupAlbums(tracks)
  const artists = groupArtists(tracks)
  const liked = [...tracks, ...lib.get().remote].filter((t) => t.liked)
  const recentPlayed = [...tracks].filter((t) => t.lastPlayed).sort((a, b) => b.lastPlayed - a.lastPlayed)
  const recentAlbums: typeof albums = []
  for (const t of recentPlayed) {
    const a = albums.find((g) => g.key === t.artist + '|' + t.album)
    if (a && !recentAlbums.includes(a)) recentAlbums.push(a)
    if (recentAlbums.length >= 12) break
  }
  const newest = [...albums].sort((a, b) => Math.max(...b.tracks.map((t) => t.addedAt)) - Math.max(...a.tracks.map((t) => t.addedAt)))
  const most = [...tracks].filter((t) => t.playCount).sort((a, b) => b.playCount - a.playCount).slice(0, 50)

  const quick = [
    { hrefTo: '#/liked', title: 'Liked Songs', liked: true, ids: liked.map((t) => t.id), context: 'Liked Songs' },
    ...playlists.slice(0, 3).map((p) => ({ hrefTo: href({ name: 'playlist', id: p.id }), title: p.name, coverId: playlistCover(p), ids: p.trackIds, context: 'Playlist · ' + p.name })),
    ...(recentAlbums.length ? recentAlbums : newest).slice(0, 8).map((a) => ({ hrefTo: href({ name: 'album', key: a.key }), title: a.name, coverId: a.coverId, ids: a.tracks.map((t) => t.id), context: 'Album · ' + a.name })),
  ].slice(0, 8)

  return (
    <div className="page home">
      <h1 className="greet">{greeting()}</h1>
      <div className="quick-grid">{quick.map((q) => <Quick key={q.hrefTo} {...q} />)}</div>

      {recentAlbums.length > 0 && (
        <Shelf title="Jump back in">
          {recentAlbums.map((a) => (
            <Card key={a.key} href={href({ name: 'album', key: a.key })} title={a.name} sub={a.sub} coverId={a.coverId} ids={a.tracks.map((t) => t.id)} context={'Album · ' + a.name} />
          ))}
        </Shelf>
      )}

      {most.length > 4 && (
        <Shelf title="Your top songs">
          <Card href="#/songs" title="On repeat" sub={`Your ${most.length} most played`} coverId={most[0].coverId} ids={most.map((t) => t.id)} context="On repeat" />
          <Card href="#/liked" title="Liked Songs" sub={`${liked.length} songs`} liked ids={liked.map((t) => t.id)} context="Liked Songs" />
          <Card href="#/songs" title="Shuffle everything" sub={`${tracks.length} songs`} coverId={tracks[Math.floor(tracks.length / 2)].coverId} ids={tracks.map((t) => t.id)} context="All songs" />
        </Shelf>
      )}

      <TrendingShelf />

      <Shelf title="Recently added" href="#/library">
        {newest.slice(0, 12).map((a) => (
          <Card key={a.key} href={href({ name: 'album', key: a.key })} title={a.name} sub={a.sub} coverId={a.coverId} ids={a.tracks.map((t) => t.id)} context={'Album · ' + a.name} />
        ))}
      </Shelf>

      <Shelf title="Your artists" href="#/library">
        {artists.slice(0, 12).map((a) => (
          <Card key={a.key} href={href({ name: 'artist', key: a.key })} title={a.name} sub="Artist" coverId={a.coverId} round ids={a.tracks.map((t) => t.id)} context={'Artist · ' + a.name} />
        ))}
      </Shelf>

      {playlists.length > 0 && (
        <Shelf title="Your playlists" href="#/library">
          {playlists.map((p) => (
            <Card key={p.id} href={href({ name: 'playlist', id: p.id })} title={p.name} sub={`${p.trackIds.length} songs`} coverId={playlistCover(p)} ids={p.trackIds} context={'Playlist · ' + p.name} />
          ))}
        </Shelf>
      )}
    </div>
  )
}
