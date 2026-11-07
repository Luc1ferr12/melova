import { Pause, Play } from 'lucide-react'
import { player, playList, toggle } from '../lib/player'
import { Cover } from './Cover'

interface Props {
  href: string
  title: string
  sub: string
  coverId?: string | null
  round?: boolean
  liked?: boolean
  ids: string[]
  context: string
}

/** Grid tile with a hover play button, used for albums, artists, playlists. */
export function Card({ href, title, sub, coverId, round, liked, ids, context }: Props) {
  const isCtx = player.use((s) => s.context === context && s.queue.length > 0)
  const playing = player.use((s) => s.playing)
  const on = isCtx && playing
  return (
    <a className="card" href={href}>
      <div className="card-art">
        <Cover coverId={coverId} size="100%" round={round} liked={liked} alt="" />
        {ids.length > 0 && (
          <button
            className={'card-play' + (on ? ' show' : '')}
            aria-label={(on ? 'Pause ' : 'Play ') + title}
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              if (isCtx) toggle()
              else playList(ids, 0, context)
            }}
          >
            {on ? <Pause size={22} fill="currentColor" /> : <Play size={22} fill="currentColor" className="nudge" />}
          </button>
        )}
      </div>
      <div className="card-title">{title}</div>
      <div className="card-sub">{sub}</div>
    </a>
  )
}

export function Shelf({ title, href, children }: { title: string; href?: string; children: React.ReactNode }) {
  return (
    <section className="shelf">
      <div className="shelf-head">
        <h2>{href ? <a href={href}>{title}</a> : title}</h2>
        {href && <a className="show-all" href={href}>Show all</a>}
      </div>
      <div className="shelf-row">{children}</div>
    </section>
  )
}
