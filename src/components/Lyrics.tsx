import { useEffect, useRef, useState } from 'react'
import type { Track } from '../lib/db'
import { activeLine, useLyrics } from '../lib/lyrics'
import { player, seek } from '../lib/player'

/** Lyrics for the current song. Synced lyrics follow the music; tap a line to jump there. */
export function LyricsView({ track, big }: { track: Track | null; big?: boolean }) {
  const { loading, lyrics } = useLyrics(track)
  const time = player.use((s) => s.time)
  const box = useRef<HTMLDivElement>(null)
  const [userScroll, setUserScroll] = useState(0)
  const lines = lyrics?.synced?.length ? lyrics.synced : null
  const cur = lines ? activeLine(lines, time) : -1

  // keep the sung line in view, unless the listener scrolled in the last 4 seconds
  useEffect(() => {
    if (!lines || Date.now() - userScroll < 4000) return
    const el = box.current?.querySelector<HTMLElement>(`[data-i="${Math.max(0, cur)}"]`)
    if (el && box.current) {
      const b = box.current
      const top = Math.max(0, el.offsetTop - b.clientHeight * 0.38)
      b.scrollTo({ top, behavior: 'smooth' })
      // some browsers skip smooth scrolling (background tabs, reduced motion); make sure we land
      const t = setTimeout(() => {
        if (Math.abs(b.scrollTop - top) > 4 && b.scrollHeight - b.clientHeight > b.scrollTop) b.scrollTop = top
      }, 700)
      return () => clearTimeout(t)
    }
  }, [cur, lines, userScroll])

  let body: React.ReactNode
  if (!track) body = <p className="lyrics-msg">Play a song to see its lyrics.</p>
  else if (loading) body = <div className="lyrics-skel">{Array.from({ length: 6 }, (_, i) => <i key={i} style={{ width: 40 + ((i * 37) % 50) + '%' }} />)}</div>
  else if (lyrics?.instrumental) body = <p className="lyrics-msg">♪ Instrumental ♪</p>
  else if (lines)
    body = lines.map((l, i) => (
      <button
        key={i}
        data-i={i}
        className={'lyric' + (i === cur ? ' on' : i < cur ? ' past' : '')}
        onClick={() => { setUserScroll(0); seek(l.time) }}
      >
        {l.text || '♪'}
      </button>
    ))
  else if (lyrics?.plain) body = <div className="lyrics-plain">{lyrics.plain}</div>
  else
    body = (
      <p className="lyrics-msg">
        No lyrics found for this song.
        <span className="small">Lyrics are matched by title and artist, so tidy tags help.</span>
      </p>
    )

  return (
    <div
      ref={box}
      className={'lyrics' + (big ? ' big' : '')}
      onWheel={() => setUserScroll(Date.now())}
      onTouchMove={() => setUserScroll(Date.now())}
    >
      {body}
      {lyrics && <p className="lyrics-credit">Lyrics from LRCLIB</p>}
    </div>
  )
}
