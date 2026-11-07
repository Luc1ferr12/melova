import { Clock3, Disc3, Heart, ListEnd, ListPlus, ListStart, MoreHorizontal, Pause, Play, Trash2, User, X } from 'lucide-react'
import { memo, type MouseEvent } from 'react'
import {
  addToPlaylist,
  createPlaylist,
  deleteTrack,
  lib,
  removeFromPlaylist,
  toggleLike,
  type Track,
} from '../lib/library'
import { addToQueue, currentId, fmt, forget, playList, player, playNext, toggle } from '../lib/player'
import { go, toast } from '../lib/ui'
import { Cover } from './Cover'
import { askConfirm, askText, openMenu } from './overlays'

export function addToPlaylistMenu(e: { clientX: number; clientY: number } | null, ids: string[]) {
  const pls = lib.get().playlists
  openMenu(
    e,
    [
      {
        label: 'New playlist',
        icon: <ListPlus size={18} />,
        onClick: async () => {
          const name = await askText('New playlist', 'My playlist #' + (pls.length + 1), 'Create')
          if (name !== null) {
            await createPlaylist(name, ids)
            toast(`Added to ${name}`)
          }
        },
      },
      ...pls.map((p) => ({
        label: p.name,
        onClick: () => {
          addToPlaylist(p.id, ids)
          toast(`Added to ${p.name}`)
        },
      })),
    ],
    'Add to playlist',
  )
}

export function trackMenu(e: { clientX: number; clientY: number } | null, t: Track, playlistId?: string) {
  openMenu(
    e,
    [
      { label: t.liked ? 'Remove from Liked Songs' : 'Save to Liked Songs', icon: <Heart size={18} fill={t.liked ? 'currentColor' : 'none'} />, onClick: () => toggleLike(t.id) },
      { label: 'Add to playlist', icon: <ListPlus size={18} />, onClick: () => addToPlaylistMenu(e, [t.id]) },
      { label: 'Play next', icon: <ListStart size={18} />, onClick: () => { playNext([t.id]); toast('Playing next') } },
      { label: 'Add to queue', icon: <ListEnd size={18} />, onClick: () => { addToQueue([t.id]); toast('Added to queue') } },
      { label: 'Go to album', icon: <Disc3 size={18} />, onClick: () => go({ name: 'album', key: t.artist + '|' + t.album }) },
      { label: 'Go to artist', icon: <User size={18} />, onClick: () => go({ name: 'artist', key: t.artist }) },
      ...(playlistId
        ? [{ label: 'Remove from this playlist', icon: <X size={18} />, onClick: () => removeFromPlaylist(playlistId, t.id) }]
        : []),
      {
        label: 'Delete from device',
        icon: <Trash2 size={18} />,
        danger: true,
        onClick: async () => {
          if (await askConfirm('Delete song?', `"${t.title}" will be removed from this device and from every playlist.`)) {
            forget(t.id)
            await deleteTrack(t.id)
            toast('Song deleted')
          }
        },
      },
    ],
    t.title,
    t.artist,
  )
}

interface Props {
  tracks: Track[]
  context: string
  playlistId?: string
  showAlbum?: boolean
  showCover?: boolean
  numbered?: 'index' | 'trackNo'
}

export function TrackList({ tracks, context, playlistId, showAlbum = true, showCover = true, numbered = 'index' }: Props) {
  const cur = player.use((s) => s.queue[s.index])
  const playing = player.use((s) => s.playing)
  const ctx = player.use((s) => s.context)
  if (!tracks.length) return null
  const ids = tracks.map((t) => t.id)
  const onPlay = (i: number) => {
    if (cur === ids[i] && ctx === context) toggle()
    else playList(ids, i, context)
  }
  return (
    <div className={'tracklist' + (showAlbum ? ' with-album' : '')} role="list">
      <div className="tl-head" aria-hidden>
        <span className="tl-num">#</span>
        <span>Title</span>
        {showAlbum && <span className="tl-album">Album</span>}
        <span className="tl-dur"><Clock3 size={16} /></span>
        <span />
      </div>
      {tracks.map((t, i) => (
        <Row
          key={t.id + ':' + i}
          t={t}
          n={numbered === 'trackNo' ? t.trackNo || i + 1 : i + 1}
          active={cur === t.id}
          playing={cur === t.id && playing}
          showAlbum={showAlbum}
          showCover={showCover}
          playlistId={playlistId}
          onPlay={() => onPlay(i)}
        />
      ))}
    </div>
  )
}

interface RowProps {
  t: Track
  n: number
  active: boolean
  playing: boolean
  showAlbum: boolean
  showCover: boolean
  playlistId?: string
  onPlay: () => void
}

const Row = memo(function Row({ t, n, active, playing, showAlbum, showCover, playlistId, onPlay }: RowProps) {
  const more = (e: MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    trackMenu(e, t, playlistId)
  }
  return (
    <div
      className={'tl-row' + (active ? ' active' : '')}
      role="listitem"
      onDoubleClick={onPlay}
      onClick={(e) => {
        // single tap plays on touch screens; desktop uses double click like most players
        if (matchMedia('(hover: none)').matches) onPlay()
        else (e.currentTarget as HTMLElement).focus()
      }}
      onKeyDown={(e) => e.key === 'Enter' && onPlay()}
      onContextMenu={more}
      tabIndex={0}
    >
      <span className="tl-num">
        <span className="n">{active && playing ? <span className="eq" aria-label="Playing"><i /><i /><i /></span> : n}</span>
        <button className="icon-btn tl-play" onClick={(e) => { e.stopPropagation(); onPlay() }} aria-label={(active && playing ? 'Pause ' : 'Play ') + t.title}>
          {active && playing ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
        </button>
      </span>
      <span className="tl-title">
        {showCover && <Cover coverId={t.coverId} size={40} />}
        <span className="tl-text">
          <span className="t">{t.title}</span>
          <a className="a" href={'#/artist/' + encodeURIComponent(t.artist)} onClick={(e) => e.stopPropagation()}>{t.artist}</a>
        </span>
      </span>
      {showAlbum && (
        <a className="tl-album" href={'#/album/' + encodeURIComponent(t.artist + '|' + t.album)} onClick={(e) => e.stopPropagation()}>{t.album}</a>
      )}
      <span className="tl-dur">
        <button className={'icon-btn like' + (t.liked ? ' on' : '')} onClick={(e) => { e.stopPropagation(); toggleLike(t.id) }} aria-label={t.liked ? 'Unlike' : 'Like'} aria-pressed={t.liked}>
          <Heart size={16} fill={t.liked ? 'currentColor' : 'none'} />
        </button>
        {fmt(t.duration)}
      </span>
      <span className="tl-more">
        <button className="icon-btn" onClick={more} aria-label={'More options for ' + t.title}>
          <MoreHorizontal size={18} />
        </button>
      </span>
    </div>
  )
})

export const isCurrent = (id: string) => currentId() === id
