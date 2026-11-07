import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createStore } from '../lib/store'
import { ui, useIsMobile } from '../lib/ui'

/* ---------------- context menu / bottom sheet ---------------- */
export interface MenuItem {
  label: string
  icon?: ReactNode
  onClick: () => void
  danger?: boolean
}
interface MenuState {
  open: boolean
  x: number
  y: number
  title?: string
  sub?: string
  items: MenuItem[]
}
const menu = createStore<MenuState>({ open: false, x: 0, y: 0, items: [] })

export function openMenu(e: { clientX: number; clientY: number } | null, items: MenuItem[], title?: string, sub?: string) {
  menu.set({ open: true, x: e?.clientX ?? innerWidth / 2, y: e?.clientY ?? innerHeight / 2, items, title, sub })
}
export const closeMenu = () => menu.set({ open: false })

export function MenuHost() {
  const s = menu.use((s) => s)
  const mobile = useIsMobile()
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ left: 0, top: 0 })

  useEffect(() => {
    if (!s.open || mobile || !ref.current) return
    const r = ref.current.getBoundingClientRect()
    setPos({
      left: Math.min(s.x, innerWidth - r.width - 8),
      top: s.y + r.height > innerHeight - 8 ? Math.max(8, s.y - r.height) : s.y,
    })
  }, [s.open, s.x, s.y, mobile, s.items])

  useEffect(() => {
    if (!s.open) return
    const k = (e: KeyboardEvent) => e.key === 'Escape' && closeMenu()
    addEventListener('keydown', k)
    ref.current?.querySelector<HTMLButtonElement>('button')?.focus()
    return () => removeEventListener('keydown', k)
  }, [s.open])

  if (!s.open) return null
  return (
    <div className={'menu-scrim' + (mobile ? ' sheet' : '')} onClick={closeMenu} onContextMenu={(e) => { e.preventDefault(); closeMenu() }}>
      <div
        ref={ref}
        role="menu"
        className={mobile ? 'sheet-panel' : 'menu'}
        style={mobile ? undefined : { left: pos.left, top: pos.top }}
        onClick={(e) => e.stopPropagation()}
      >
        {mobile && s.title && (
          <div className="sheet-head">
            <div className="sheet-title">{s.title}</div>
            {s.sub && <div className="muted small">{s.sub}</div>}
          </div>
        )}
        {s.items.map((it, i) => (
          <button
            key={i}
            role="menuitem"
            className={'menu-item' + (it.danger ? ' danger' : '')}
            onClick={() => {
              closeMenu()
              it.onClick()
            }}
          >
            {it.icon}
            <span>{it.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

/* ---------------- text prompt / confirm dialog ---------------- */
interface DialogState {
  open: boolean
  title: string
  body?: string
  input?: string
  confirm: string
  danger?: boolean
  resolve?: (v: string | null) => void
}
const dialog = createStore<DialogState>({ open: false, title: '', confirm: 'OK' })

export function askText(title: string, initial = '', confirm = 'Save'): Promise<string | null> {
  return new Promise((resolve) => dialog.set({ open: true, title, input: initial, confirm, body: undefined, danger: false, resolve }))
}
export function askConfirm(title: string, body: string, confirm = 'Delete'): Promise<boolean> {
  return new Promise((resolve) =>
    dialog.set({ open: true, title, body, input: undefined, confirm, danger: true, resolve: (v) => resolve(v !== null) }),
  )
}

export function DialogHost() {
  const s = dialog.use((s) => s)
  const [val, setVal] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (s.open) {
      setVal(s.input ?? '')
      setTimeout(() => inputRef.current?.select(), 30)
    }
  }, [s.open, s.input])
  if (!s.open) return null
  const finish = (v: string | null) => {
    s.resolve?.(v)
    dialog.set({ open: false })
  }
  return (
    <div className="dialog-scrim" onClick={() => finish(null)}>
      <form
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-label={s.title}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.key === 'Escape' && finish(null)}
        onSubmit={(e) => {
          e.preventDefault()
          finish(s.input !== undefined ? val : '')
        }}
      >
        <h2>{s.title}</h2>
        {s.body && <p className="muted">{s.body}</p>}
        {s.input !== undefined && (
          <input ref={inputRef} className="field" value={val} onChange={(e) => setVal(e.target.value)} maxLength={100} aria-label={s.title} autoFocus />
        )}
        <div className="dialog-actions">
          <button type="button" className="btn ghost" onClick={() => finish(null)}>Cancel</button>
          <button type="submit" className={'btn ' + (s.danger ? 'danger' : 'primary')} autoFocus={s.input === undefined}>{s.confirm}</button>
        </div>
      </form>
    </div>
  )
}

/* ---------------- toast ---------------- */
export function ToastHost() {
  const t = ui.use((s) => s.toast)
  return (
    <div className="toast-wrap" aria-live="polite">
      {t && <div key={t.id} className="toast">{t.text}</div>}
    </div>
  )
}
