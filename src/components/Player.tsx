import {
  ChevronDown,
  Heart,
  ListMusic,
  MicVocal,
  MoreHorizontal,
  Moon,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume1,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { toggleLike, trackById, useCover, lib } from '../lib/library'
import {
  cycleRepeat,
  fmt,
  jump,
  next,
  player,
  prev,
  removeFromQueue,
  seek,
  setSleep,
  setVolume,
  toggle,
  toggleMute,
  toggleShuffle,
} from '../lib/player'
import { toast, ui, useDominant } from '../lib/ui'
import { Cover } from './Cover'
import { openMenu } from './overlays'
import { albumHref, artistHref, trackMenu } from './TrackList'
import { LyricsView } from './Lyrics'

function useCurrent() {
  const id = player.use((s) => s.queue[s.index])
  // re-render when the track's like state changes
  return lib.use((s) => (id ? s.tracks.find((t) => t.id === id) ?? s.remote.find((t) => t.id === id) ?? trackById(id) ?? null : null))
}

/* ---------------- slider ---------------- */
function Slider({ value, max, onChange, label, className = '' }: { value: number; max: number; onChange: (v: number) => void; label: string; className?: string }) {
  const [drag, setDrag] = useState<number | null>(null)
  const v = drag ?? value
  const pct = max > 0 ? Math.min(100, (v / max) * 100) : 0
  return (
    <input
      type="range"
      className={'slider ' + className}
      min={0}
      max={max || 1}
      step="any"
      value={v}
      aria-label={label}
      style={{ ['--pct' as string]: pct + '%' }}
      onChange={(e) => setDrag(+e.target.value)}
      onPointerUp={() => { if (drag !== null) { onChange(drag); setDrag(null) } }}
      onKeyUp={() => { if (drag !== null) { onChange(drag); setDrag(null) } }}
      onBlur={() => setDrag(null)}
    />
  )
}

function Seek({ compact }: { compact?: boolean }) {
  const time = player.use((s) => s.time)
  const duration = player.use((s) => s.duration)
  return (
    <div className={'seek' + (compact ? ' compact' : '')}>
      <span className="time">{fmt(time)}</span>
      <Slider value={time} max={duration} onChange={seek} label="Seek" />
      <span className="time">{fmt(duration)}</span>
    </div>
  )
}

function Controls({ big }: { big?: boolean }) {
  const playing = player.use((s) => s.playing)
  const shuffle = player.use((s) => s.shuffle)
  const repeat = player.use((s) => s.repeat)
  const s = big ? 28 : 18
  return (
    <div className={'controls' + (big ? ' big' : '')}>
      <button className={'icon-btn toggle' + (shuffle ? ' on' : '')} onClick={toggleShuffle} aria-label="Shuffle" aria-pressed={shuffle} title="Shuffle">
        <Shuffle size={s - 2} />
      </button>
      <button className="icon-btn" onClick={prev} aria-label="Previous" title="Previous">
        <SkipBack size={s} fill="currentColor" />
      </button>
      <button className="play-btn" onClick={toggle} aria-label={playing ? 'Pause' : 'Play'} title={playing ? 'Pause' : 'Play'}>
        {playing ? <Pause size={big ? 30 : 18} fill="currentColor" /> : <Play size={big ? 30 : 18} fill="currentColor" className="nudge" />}
      </button>
      <button className="icon-btn" onClick={() => next()} aria-label="Next" title="Next">
        <SkipForward size={s} fill="currentColor" />
      </button>
      <button className={'icon-btn toggle' + (repeat !== 'off' ? ' on' : '')} onClick={cycleRepeat} aria-label={'Repeat: ' + repeat} title={'Repeat: ' + repeat}>
        {repeat === 'one' ? <Repeat1 size={s - 2} /> : <Repeat size={s - 2} />}
      </button>
    </div>
  )
}

function sleepMenu(e: { clientX: number; clientY: number } | null) {
  const on = player.get().sleepAt
  openMenu(
    e,
    [
      ...[15, 30, 45, 60].map((m) => ({ label: `${m} minutes`, onClick: () => { setSleep(m); toast(`Music stops in ${m} min`) } })),
      ...(on ? [{ label: 'Turn off timer', icon: <X size={18} />, onClick: () => { setSleep(null); toast('Sleep timer off') } }] : []),
    ],
    'Sleep timer',
    on ? `Stops at ${new Date(on).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : undefined,
  )
}

/* ---------------- desktop bar ---------------- */
export function PlayerBar() {
  const t = useCurrent()
  const volume = player.use((s) => s.volume)
  const muted = player.use((s) => s.muted)
  const sleepAt = player.use((s) => s.sleepAt)
  const panel = ui.use((s) => s.panel)
  const VolIcon = muted || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2
  return (
    <footer className="player-bar">
      <div className="pb-left">
        {t && (
          <>
            <button className="pb-cover" onClick={() => ui.set({ nowPlaying: true })} aria-label="Open now playing">
              <Cover coverId={t.coverId} size={56} />
            </button>
            <div className="pb-text">
              <a className="t" href={albumHref(t)}>{t.title}</a>
              <a className="a" href={artistHref(t)}>{t.artist}</a>
            </div>
            <button className={'icon-btn like' + (t.liked ? ' on' : '')} onClick={() => toggleLike(t.id)} aria-label={t.liked ? 'Unlike' : 'Like'} aria-pressed={t.liked}>
              <Heart size={18} fill={t.liked ? 'currentColor' : 'none'} />
            </button>
          </>
        )}
      </div>
      <div className="pb-center">
        <Controls />
        <Seek />
      </div>
      <div className="pb-right">
        <button className={'icon-btn toggle' + (sleepAt ? ' on' : '')} onClick={(e) => sleepMenu(e)} aria-label="Sleep timer" title="Sleep timer">
          <Moon size={18} />
        </button>
        <button className={'icon-btn toggle' + (panel === 'lyrics' ? ' on' : '')} onClick={() => ui.set({ panel: panel === 'lyrics' ? null : 'lyrics' })} aria-label="Lyrics" aria-pressed={panel === 'lyrics'} title="Lyrics">
          <MicVocal size={18} />
        </button>
        <button className={'icon-btn toggle' + (panel === 'queue' ? ' on' : '')} onClick={() => ui.set({ panel: panel === 'queue' ? null : 'queue' })} aria-label="Queue" aria-pressed={panel === 'queue'} title="Queue">
          <ListMusic size={18} />
        </button>
        <button className="icon-btn" onClick={toggleMute} aria-label={muted ? 'Unmute' : 'Mute'} title={muted ? 'Unmute' : 'Mute'}>
          <VolIcon size={18} />
        </button>
        <Slider className="vol" value={muted ? 0 : volume} max={1} onChange={setVolume} label="Volume" />
      </div>
    </footer>
  )
}

/* ---------------- mobile mini player ---------------- */
export function MiniPlayer() {
  const t = useCurrent()
  const playing = player.use((s) => s.playing)
  const time = player.use((s) => s.time)
  const duration = player.use((s) => s.duration)
  const url = useCover(t?.coverId)
  const bg = useDominant(url)
  if (!t) return null
  return (
    <div className="mini" style={{ background: bg }} onClick={() => ui.set({ nowPlaying: true })} role="button" aria-label="Open now playing" tabIndex={0}>
      <Cover coverId={t.coverId} size={40} />
      <div className="mini-text">
        <div className="t">{t.title}</div>
        <div className="a">{t.artist}</div>
      </div>
      <button className={'icon-btn like' + (t.liked ? ' on' : '')} onClick={(e) => { e.stopPropagation(); toggleLike(t.id) }} aria-label={t.liked ? 'Unlike' : 'Like'}>
        <Heart size={22} fill={t.liked ? 'currentColor' : 'none'} />
      </button>
      <button className="icon-btn" onClick={(e) => { e.stopPropagation(); toggle() }} aria-label={playing ? 'Pause' : 'Play'}>
        {playing ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" />}
      </button>
      <div className="mini-progress" style={{ width: (duration ? (time / duration) * 100 : 0) + '%' }} />
    </div>
  )
}

/* ---------------- full screen now playing ---------------- */
export function NowPlaying() {
  const open = ui.use((s) => s.nowPlaying)
  const t = useCurrent()
  const ctx = player.use((s) => s.context)
  const sleepAt = player.use((s) => s.sleepAt)
  const url = useCover(t?.coverId)
  const bg = useDominant(url)
  const [view, setView] = useState<'art' | 'queue' | 'lyrics'>('art')
  const flip = (v: 'queue' | 'lyrics') => setView(view === v ? 'art' : v)
  useEffect(() => {
    if (!open) return
    const k = (e: KeyboardEvent) => e.key === 'Escape' && ui.set({ nowPlaying: false })
    addEventListener('keydown', k)
    return () => removeEventListener('keydown', k)
  }, [open])
  if (!open || !t) return null
  return (
    <div className="np" style={{ ['--np' as string]: bg }} role="dialog" aria-label="Now playing">
      <header className="np-head">
        <button className="icon-btn" onClick={() => ui.set({ nowPlaying: false })} aria-label="Close">
          <ChevronDown size={28} />
        </button>
        <div className="np-ctx">
          <div className="small muted-light">Playing from</div>
          <div className="np-ctx-name">{ctx || 'Your library'}</div>
        </div>
        <button className="icon-btn" onClick={(e) => trackMenu(e, t)} aria-label="More">
          <MoreHorizontal size={24} />
        </button>
      </header>
      {view === 'queue' ? (
        <div className="np-queue"><QueueList /></div>
      ) : view === 'lyrics' ? (
        <div className="np-lyrics"><LyricsView track={t} big /></div>
      ) : (
        <div className="np-art">
          <Cover coverId={t.coverId} size="100%" className="np-cover" alt={t.album} />
        </div>
      )}
      <div className="np-info">
        <div className="np-text">
          <div className="np-title">{t.title}</div>
          <a className="np-artist" href={artistHref(t)} onClick={() => ui.set({ nowPlaying: false })}>{t.artist}</a>
        </div>
        <button className={'icon-btn like' + (t.liked ? ' on' : '')} onClick={() => toggleLike(t.id)} aria-label={t.liked ? 'Unlike' : 'Like'}>
          <Heart size={26} fill={t.liked ? 'currentColor' : 'none'} />
        </button>
      </div>
      <Seek compact />
      <Controls big />
      <div className="np-foot">
        <button className={'icon-btn toggle' + (sleepAt ? ' on' : '')} onClick={(e) => sleepMenu(e)} aria-label="Sleep timer"><Moon size={20} /></button>
        <button className={'icon-btn toggle' + (view === 'lyrics' ? ' on' : '')} onClick={() => flip('lyrics')} aria-label="Lyrics" aria-pressed={view === 'lyrics'}><MicVocal size={20} /></button>
        <button className={'icon-btn toggle' + (view === 'queue' ? ' on' : '')} onClick={() => flip('queue')} aria-label="Queue" aria-pressed={view === 'queue'}><ListMusic size={20} /></button>
      </div>
    </div>
  )
}

/* ---------------- queue ---------------- */
export function QueueList() {
  const queue = player.use((s) => s.queue)
  const index = player.use((s) => s.index)
  lib.use((s) => s.remote) // re-render when saved online tracks change
  lib.use((s) => s.tracks)
  const cur = trackById(queue[index])
  const upcoming = queue.slice(index + 1).map((id, k) => ({ t: trackById(id), i: index + 1 + k })).filter((x) => x.t)
  return (
    <div className="queue">
      <h3>Now playing</h3>
      {cur ? <QueueRow t={cur} active onClick={() => toggle()} /> : <p className="muted">Nothing playing.</p>}
      <h3>Next up</h3>
      {upcoming.length ? (
        upcoming.slice(0, 200).map(({ t, i }) => (
          <QueueRow key={i} t={t!} onClick={() => jump(i)} onRemove={() => removeFromQueue(i)} />
        ))
      ) : (
        <p className="muted">The queue is empty. Add songs from any list with “Add to queue”.</p>
      )}
    </div>
  )
}

function QueueRow({ t, active, onClick, onRemove }: { t: NonNullable<ReturnType<typeof trackById>>; active?: boolean; onClick: () => void; onRemove?: () => void }) {
  return (
    <div className={'q-row' + (active ? ' active' : '')}>
      <button className="q-main" onClick={onClick}>
        <Cover coverId={t.coverId} size={40} />
        <span className="tl-text">
          <span className="t">{t.title}</span>
          <span className="a">{t.artist}</span>
        </span>
      </button>
      {onRemove && (
        <button className="icon-btn" onClick={onRemove} aria-label={'Remove ' + t.title + ' from queue'}>
          <X size={16} />
        </button>
      )}
    </div>
  )
}

export function QueuePanel() {
  const panel = ui.use((s) => s.panel)
  const t = useCurrent()
  if (!panel) return null
  const title = panel === 'queue' ? 'Queue' : 'Lyrics'
  return (
    <aside className={'side-panel' + (panel === 'lyrics' ? ' lyrics-panel' : '')} aria-label={title}>
      <div className="side-panel-head">
        <h2>{title}</h2>
        <button className="icon-btn" onClick={() => ui.set({ panel: null })} aria-label={'Close ' + title.toLowerCase()}><X size={18} /></button>
      </div>
      {panel === 'queue' ? <QueueList /> : <LyricsView track={t} />}
    </aside>
  )
}
