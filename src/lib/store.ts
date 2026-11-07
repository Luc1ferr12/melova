import { useSyncExternalStore } from 'react'

// Minimal external store: get / set / subscribe, plus a React hook with a selector.
export function createStore<T extends object>(initial: T) {
  let state = initial
  const subs = new Set<() => void>()
  const get = () => state
  const set = (patch: Partial<T> | ((s: T) => Partial<T>)) => {
    const next = typeof patch === 'function' ? patch(state) : patch
    state = { ...state, ...next }
    subs.forEach((f) => f())
  }
  const subscribe = (f: () => void) => {
    subs.add(f)
    return () => subs.delete(f)
  }
  function use<R>(selector: (s: T) => R): R {
    return useSyncExternalStore(subscribe, () => selector(state), () => selector(state))
  }
  return { get, set, subscribe, use }
}
