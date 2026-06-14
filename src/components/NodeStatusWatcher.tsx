import { useEffect, useRef } from 'react'
import { useToast } from './Toast'
import { displayName } from '../utils/derive'
import type { Node } from '../types'

interface Props {
  nodes: Map<string, Node>
}

let askedPermission = false

/** 节点离线时发浏览器原生通知(权限按需申请,失败静默) */
function nativeNotify(title: string, body: string) {
  if (typeof Notification === 'undefined') return
  const fire = () => {
    try { new Notification(title, { body, tag: 'nodeget-status' }) } catch { /* ignore */ }
  }
  if (Notification.permission === 'granted') {
    fire()
  } else if (Notification.permission === 'default' && !askedPermission) {
    askedPermission = true
    Notification.requestPermission().then(p => { if (p === 'granted') fire() }).catch(() => {})
  }
}

export function NodeStatusWatcher({ nodes }: Props) {
  const prevRef = useRef<Map<string, boolean>>(new Map())
  const { addToast } = useToast()
  const initialRef = useRef(true)

  useEffect(() => {
    if (nodes.size === 0) return

    // Skip first render
    if (initialRef.current) {
      initialRef.current = false
      const map = new Map<string, boolean>()
      for (const [uuid, node] of nodes) {
        map.set(uuid, node.online)
      }
      prevRef.current = map
      return
    }

    const prev = prevRef.current
    let changes = 0
    let onlines = 0
    let offlines = 0

    for (const [uuid, node] of nodes) {
      const wasOnline = prev.get(uuid)
      const isOnline = node.online

      if (wasOnline !== isOnline) {
        changes++
        if (isOnline) onlines++
        else offlines++
      }
    }

    // Update prev
    const next = new Map<string, boolean>()
    for (const [uuid, node] of nodes) {
      next.set(uuid, node.online)
    }
    prevRef.current = next

    if (changes > 0) {
      const offlineNodes = [...nodes.values()].filter(n => !n.online && prev.get(n.uuid))
      const onlineNodes = [...nodes.values()].filter(n => n.online && prev.get(n.uuid) === false)

      if (changes === 1) {
        if (onlines === 1) {
          addToast({ type: 'success', title: '节点上线', message: onlineNodes[0] ? displayName(onlineNodes[0]) : '' })
        } else {
          const name = offlineNodes[0] ? displayName(offlineNodes[0]) : ''
          addToast({ type: 'error', title: '节点离线', message: name })
          nativeNotify('🔴 节点离线', name)
        }
      } else {
        addToast({
          type: 'warning',
          title: `${changes} 个节点状态变更`,
          message: `${onlines} 上线 · ${offlines} 离线`,
        })
        if (offlines > 0) {
          nativeNotify(`🔴 ${offlines} 个节点离线`, offlineNodes.map(displayName).slice(0, 5).join('、'))
        }
      }
    }
  }, [nodes, addToast])

  return null
}
