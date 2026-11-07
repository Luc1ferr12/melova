import { Heart, Music2, User } from 'lucide-react'
import { useCover } from '../lib/library'

interface Props {
  coverId?: string | null
  size?: number | string
  round?: boolean
  liked?: boolean
  className?: string
  alt?: string
}

/** Album art, or a generated tile when a file has none. */
export function Cover({ coverId, size = 48, round, liked, className = '', alt = '' }: Props) {
  const url = useCover(coverId)
  const style = { width: size, height: size }
  const cls = `cover ${round ? 'round' : ''} ${className}`
  if (liked)
    return (
      <div className={cls + ' cover-liked'} style={style} aria-hidden>
        <Heart fill="currentColor" size="40%" />
      </div>
    )
  if (url) return <img className={cls} style={style} src={url} alt={alt} loading="lazy" draggable={false} />
  return (
    <div className={cls + ' cover-empty'} style={style} aria-hidden>
      {round ? <User size="42%" /> : <Music2 size="42%" />}
    </div>
  )
}
