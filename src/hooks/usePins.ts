import { useSyncExternalStore } from 'react'

// 置顶节点(localStorage 持久化,跨组件同步的外部 store)
const KEY = 'nodeget.pins'

function read(): Set<string> {
  try {
    const a = JSON.parse(localStorage.getItem(KEY) || '[]')
    return new Set(Array.isArray(a) ? a : [])
  } catch {
    return new Set()
  }
}

let state = read()
const listeners = new Set<() => void>()

function emit() { for (const l of listeners) l() }
function persist() {
  try { localStorage.setItem(KEY, JSON.stringify([...state])) } catch { /* ignore */ }
}

export function togglePin(uuid: string) {
  const next = new Set(state)
  if (next.has(uuid)) next.delete(uuid)
  else next.add(uuid)
  state = next
  persist()
  emit()
}

export function isPinned(uuid: string) {
  return state.has(uuid)
}

function subscribe(l: () => void) {
  listeners.add(l)
  return () => { listeners.delete(l) }
}

/** 订阅置顶集合(返回的 Set 引用仅在变更时改变) */
export function usePins(): Set<string> {
  return useSyncExternalStore(subscribe, () => state, () => state)
}
