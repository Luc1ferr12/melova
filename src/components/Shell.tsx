import { Compass, FolderOpen, Home, Library, Plus, Search, Upload } from 'lucide-react'
import { useRef } from 'react'
import { createPlaylist, importFiles, lib, playlistCover } from '../lib/library'
import { go, toast, type Route } from '../lib/ui'
import { Cover } from './Cover'
import { askText, openMenu } from './overlays'

/* ---------------- import ---------------- */
let fileInput: HTMLInputElement | null = null
let folderInput: HTMLInputElement | null = null

export async function runImport(files: FileList | File[] | null) {
  if (!files || !files.length) return
  const { added: n, failed } = await importFiles(files)
  if (failed.length) toast(`Added ${n}. ${failed.length} file${failed.length === 1 ? '' : 's'} can't be played on this device`)
  else toast(n ? `Added ${n} song${n === 1 ? '' : 's'}` : 'No new songs found (already added, or not audio)')
}

export function ImportInputs() {
  const a = useRef<HTMLInputElement>(null)
  const b = useRef<HTMLInputElement>(null)
  return (
    <>
      <input
        ref={(el) => { (a as { current: HTMLInputElement | null }).current = el; fileInput = el }}
        type="file"
        accept="audio/*,.mp3,.m4a,.flac,.ogg,.opus,.wav,.aac"
        multiple
        hidden
        onChange={(e) => { runImport(e.target.files); e.target.value = '' }}
      />
      <input
        ref={(el) => { (b as { current: HTMLInputElement | null }).current = el; folderInput = el; el?.setAttribute('webkitdirectory', '') }}
        type="file"
        multiple
        hidden
        onChange={(e) => { runImport(e.target.files); e.target.value = '' }}
      />
    </>
  )
}

export const pickFiles = () => fileInput?.click()
export const pickFolder = () => folderInput?.click()

export function importMenu(e: { clientX: number; clientY: number } | null) {
  const mobile = matchMedia('(hover: none)').matches
  if (mobile) return pickFiles()
  openMenu(e, [
    { label: 'Add music files', icon: <Upload size={18} />, onClick: pickFiles },
    { label: 'Add a whole folder', icon: <FolderOpen size={18} />, onClick: pickFolder },
  ])
}

export async function newPlaylist() {
  const n = lib.get().playlists.length + 1
  const name = await askText('New playlist', 'My playlist #' + n, 'Create')
  if (name === null) return
  const p = await createPlaylist(name)
  go({ name: 'playlist', id: p.id })
}

export function ImportProgress() {
  const imp = lib.use((s) => s.importing)
  if (!imp) return null
  return (
    <div className="import-progress" role="status">
      <div className="small">Adding songs… {imp.done}/{imp.total}</div>
      <div className="bar"><i style={{ width: (imp.done / imp.total) * 100 + '%' }} /></div>
    </div>
  )
}

/* ---------------- brand mark ---------------- */
export function Logo() {
  return (
    <a className="logo" href="#/" aria-label="Melova home">
      <svg viewBox="0 0 32 32" width="30" height="30" aria-hidden>
        <rect width="32" height="32" rx="9" fill="var(--accent)" />
        <path d="M8 21V12.5l4.5 5 4.5-5V21" fill="none" stroke="var(--on-accent)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="22.5" cy="19" r="2.6" fill="var(--on-accent)" />
        <path d="M25.1 19V10.5" stroke="var(--on-accent)" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
      <span>Melova</span>
    </a>
  )
}

/* ---------------- desktop sidebar ---------------- */
export function Sidebar({ route }: { route: Route }) {
  const playlists = lib.use((s) => s.playlists)
  const likedCount = lib.use((s) => s.tracks.filter((t) => t.liked).length + s.remote.filter((t) => t.liked).length)
  const count = lib.use((s) => s.tracks.length)
  return (
    <nav className="sidebar" aria-label="Main">
      <div className="panel nav-panel">
        <Logo />
        <a className={'nav-link' + (route.name === 'home' ? ' on' : '')} href="#/"><Home size={24} /> Home</a>
        <a className={'nav-link' + (route.name === 'search' ? ' on' : '')} href="#/search"><Search size={24} /> Search</a>
        <a className={'nav-link' + (route.name === 'explore' || route.name === 'onlineArtist' ? ' on' : '')} href="#/explore"><Compass size={24} /> Explore</a>
      </div>
      <div className="panel lib-panel">
        <div className="lib-head">
          <a className={'nav-link' + (route.name === 'library' ? ' on' : '')} href="#/library"><Library size={24} /> Your Library</a>
          <button className="icon-btn" onClick={newPlaylist} aria-label="Create playlist" title="Create playlist"><Plus size={20} /></button>
        </div>
        <button className="btn import-btn" onClick={(e) => importMenu(e)}><Upload size={16} /> Add music</button>
        <ImportProgress />
        <div className="lib-list">
          <a className={'lib-item' + (route.name === 'liked' ? ' on' : '')} href="#/liked">
            <Cover liked size={48} />
            <span className="tl-text"><span className="t">Liked Songs</span><span className="a">Playlist · {likedCount} songs</span></span>
          </a>
          <a className={'lib-item' + (route.name === 'songs' ? ' on' : '')} href="#/songs">
            <div className="cover cover-all" style={{ width: 48, height: 48 }} aria-hidden>All</div>
            <span className="tl-text"><span className="t">All songs</span><span className="a">{count} songs on this device</span></span>
          </a>
          {playlists.map((p) => (
            <a key={p.id} className={'lib-item' + (route.name === 'playlist' && route.id === p.id ? ' on' : '')} href={'#/playlist/' + encodeURIComponent(p.id)}>
              <Cover coverId={playlistCover(p)} size={48} />
              <span className="tl-text"><span className="t">{p.name}</span><span className="a">Playlist · {p.trackIds.length} songs</span></span>
            </a>
          ))}
        </div>
      </div>
    </nav>
  )
}

/* ---------------- mobile tab bar ---------------- */
export function TabBar({ route }: { route: Route }) {
  const tab = (r: Route['name'], hrefTo: string, Icon: typeof Home, label: string) => (
    <a className={'tab' + (route.name === r ? ' on' : '')} href={hrefTo} aria-current={route.name === r ? 'page' : undefined}>
      <Icon size={24} strokeWidth={route.name === r ? 2.6 : 2} />
      <span>{label}</span>
    </a>
  )
  return (
    <nav className="tabbar" aria-label="Main">
      {tab('home', '#/', Home, 'Home')}
      {tab('search', '#/search', Search, 'Search')}
      {tab('explore', '#/explore', Compass, 'Explore')}
      {tab('library', '#/library', Library, 'Your Library')}
      <button className="tab" onClick={(e) => importMenu(e)}>
        <Plus size={24} />
        <span>Add</span>
      </button>
    </nav>
  )
}
