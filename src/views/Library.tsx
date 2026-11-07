import { Plus } from 'lucide-react'
import { useState } from 'react'
import { Cover } from '../components/Cover'
import { newPlaylist } from '../components/Shell'
import { groupAlbums, groupArtists, lib, playlistCover } from '../lib/library'
import { href } from '../lib/ui'

type Filter = 'all' | 'playlists' | 'artists' | 'albums'

interface Item {
  key: string
  href: string
  title: string
  sub: string
  coverId?: string | null
  round?: boolean
  liked?: boolean
}

export function Library() {
  const tracks = lib.use((s) => s.tracks)
  const playlists = lib.use((s) => s.playlists)
  const [f, setF] = useState<Filter>(() => (sessionStorage.getItem('melova.libf') as Filter) || 'all')
  const pick = (v: Filter) => {
    const next = f === v ? 'all' : v
    setF(next)
    sessionStorage.setItem('melova.libf', next)
  }

  const liked = tracks.filter((t) => t.liked).length
  const items: Item[] = []
  if (f === 'all' || f === 'playlists') {
    items.push({ key: 'liked', href: '#/liked', title: 'Liked Songs', sub: `Playlist · ${liked} songs`, liked: true })
    items.push({ key: 'songs', href: '#/songs', title: 'All songs', sub: `${tracks.length} songs on this device` })
    playlists.forEach((p) => items.push({ key: p.id, href: href({ name: 'playlist', id: p.id }), title: p.name, sub: `Playlist · ${p.trackIds.length} songs`, coverId: playlistCover(p) }))
  }
  if (f === 'all' || f === 'artists')
    groupArtists(tracks).forEach((a) => items.push({ key: 'ar' + a.key, href: href({ name: 'artist', key: a.key }), title: a.name, sub: 'Artist', coverId: a.coverId, round: true }))
  if (f === 'all' || f === 'albums')
    groupAlbums(tracks).forEach((a) => items.push({ key: 'al' + a.key, href: href({ name: 'album', key: a.key }), title: a.name, sub: 'Album · ' + a.sub, coverId: a.coverId }))

  return (
    <div className="page">
      <div className="page-head-row">
        <h1 className="page-title">Your Library</h1>
        <button className="icon-btn" onClick={newPlaylist} aria-label="Create playlist" title="Create playlist"><Plus size={24} /></button>
      </div>
      <div className="chips" role="group" aria-label="Filter">
        {(['playlists', 'artists', 'albums'] as const).map((v) => (
          <button key={v} className={'chip' + (f === v ? ' on' : '')} onClick={() => pick(v)} aria-pressed={f === v}>
            {v[0].toUpperCase() + v.slice(1)}
          </button>
        ))}
      </div>
      <div className="lib-rows">
        {items.map((it) => (
          <a key={it.key} className="lib-item" href={it.href}>
            {it.key === 'songs' ? (
              <div className="cover cover-all" style={{ width: 56, height: 56 }} aria-hidden>All</div>
            ) : (
              <Cover coverId={it.coverId} round={it.round} liked={it.liked} size={56} />
            )}
            <span className="tl-text"><span className="t">{it.title}</span><span className="a">{it.sub}</span></span>
          </a>
        ))}
      </div>
    </div>
  )
}
