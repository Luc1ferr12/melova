import { Upload } from 'lucide-react'
import { useEffect, useState } from 'react'
import { DialogHost, MenuHost, ToastHost } from './components/overlays'
import { MiniPlayer, NowPlaying, PlayerBar, QueueList, QueuePanel } from './components/Player'
import { ImportInputs, ImportProgress, Logo, runImport, Sidebar, TabBar } from './components/Shell'
import { lib, loadLibrary } from './lib/library'
import { next, player, prev, reconcile, seek, setVolume, toggle } from './lib/player'
import { useIsMobile, useRoute } from './lib/ui'
import { Collection } from './views/Collection'
import { Home } from './views/Home'
import { Library } from './views/Library'
import { Search } from './views/Search'

export default function App() {
  const route = useRoute()
  const mobile = useIsMobile()
  const loaded = lib.use((s) => s.loaded)
  const [dragging, setDragging] = useState(false)

  useEffect(() => {
    loadLibrary().then(reconcile)
  }, [])

  // keyboard shortcuts (desktop)
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      if (el.closest('input, textarea, select, [role=dialog] form')) return
      const s = player.get()
      if (e.code === 'Space' && !el.closest('button, a')) { e.preventDefault(); toggle() }
      else if (e.code === 'ArrowRight' && e.shiftKey) next()
      else if (e.code === 'ArrowLeft' && e.shiftKey) prev()
      else if (e.code === 'ArrowRight' && e.altKey) seek(Math.min(s.duration, s.time + 10))
      else if (e.code === 'ArrowLeft' && e.altKey) seek(Math.max(0, s.time - 10))
      else if (e.code === 'ArrowUp' && e.shiftKey) setVolume(Math.min(1, s.volume + 0.1))
      else if (e.code === 'ArrowDown' && e.shiftKey) setVolume(Math.max(0, s.volume - 0.1))
    }
    addEventListener('keydown', k)
    return () => removeEventListener('keydown', k)
  }, [])

  // drag and drop files anywhere
  useEffect(() => {
    let depth = 0
    const has = (e: DragEvent) => e.dataTransfer?.types.includes('Files')
    const enter = (e: DragEvent) => { if (has(e)) { depth++; setDragging(true) } }
    const leave = () => { depth = Math.max(0, depth - 1); if (!depth) setDragging(false) }
    const over = (e: DragEvent) => { if (has(e)) e.preventDefault() }
    const drop = (e: DragEvent) => {
      if (!has(e)) return
      e.preventDefault()
      depth = 0
      setDragging(false)
      runImport(e.dataTransfer!.files)
    }
    addEventListener('dragenter', enter)
    addEventListener('dragleave', leave)
    addEventListener('dragover', over)
    addEventListener('drop', drop)
    return () => {
      removeEventListener('dragenter', enter)
      removeEventListener('dragleave', leave)
      removeEventListener('dragover', over)
      removeEventListener('drop', drop)
    }
  }, [])

  let view: React.ReactNode
  if (!loaded) view = <div className="page"><div className="skeleton-title" /><div className="skeleton-grid">{Array.from({ length: 6 }, (_, i) => <i key={i} />)}</div></div>
  else if (route.name === 'home') view = <Home />
  else if (route.name === 'search') view = <Search />
  else if (route.name === 'library') view = <Library />
  else if (route.name === 'queue') view = <div className="page"><h1 className="page-title">Queue</h1><QueueList /></div>
  else view = <Collection route={route} key={JSON.stringify(route)} />

  return (
    <div className={'app' + (mobile ? ' is-mobile' : '')}>
      <ImportInputs />
      {mobile ? (
        <>
          <header className="m-top"><Logo /></header>
          <main className="main">
            <ImportProgress />
            {view}
          </main>
          <div className="m-bottom">
            <MiniPlayer />
            <TabBar route={route} />
          </div>
        </>
      ) : (
        <>
          <Sidebar route={route} />
          <main className="main panel">{view}</main>
          <QueuePanel />
          <PlayerBar />
        </>
      )}
      <NowPlaying />
      <MenuHost />
      <DialogHost />
      <ToastHost />
      {dragging && (
        <div className="drop-zone" aria-hidden>
          <Upload size={48} />
          <div>Drop music to add it to Melova</div>
        </div>
      )}
    </div>
  )
}
