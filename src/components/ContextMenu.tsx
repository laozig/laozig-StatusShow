import { useEffect, useRef, useState, type ComponentType } from 'react'
import {
  Eye, Copy, Hash, GitCompareArrows, RefreshCw, LayoutGrid, Table as TableIcon,
  Globe, Coins, Palette, ArrowUp, Maximize, Pin, PinOff,
} from 'lucide-react'
import { useToast } from './Toast'
import { displayName } from '../utils/derive'
import { isPinned } from '../hooks/usePins'
import { cn } from '../utils/cn'
import type { Node, View } from '../types'

interface Props {
  nodes: Map<string, Node>
  onOpenNode: (uuid: string) => void
  onToggleCompare: (uuid: string) => void
  onTogglePin: (uuid: string) => void
  onTheme: () => void
  onBilling: () => void
  onSetView: (v: View) => void
  onRefresh: () => void
}

interface MenuEntry {
  kind: 'item' | 'divider' | 'label'
  label?: string
  icon?: ComponentType<{ className?: string }>
  onClick?: () => void
}

interface MenuState {
  x: number
  y: number
  uuid: string | null
}

function isFullscreen() {
  return typeof document !== 'undefined' && !!document.fullscreenElement
}

function toggleFullscreen() {
  if (isFullscreen()) document.exitFullscreen?.()
  else document.documentElement.requestFullscreen?.()
}

export function ContextMenu({
  nodes, onOpenNode, onToggleCompare, onTogglePin, onTheme, onBilling, onSetView, onRefresh,
}: Props) {
  const [state, setState] = useState<MenuState | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const toast = useToast()

  useEffect(() => {
    const onCtx = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null
      // 输入框/可编辑区:保留浏览器原生右键菜单(复制/粘贴)
      if (target?.closest('input, textarea, [contenteditable="true"]')) return
      e.preventDefault()
      const el = target?.closest('[data-node-uuid]') as HTMLElement | null
      setState({ x: e.clientX, y: e.clientY, uuid: el?.getAttribute('data-node-uuid') ?? null })
    }
    const close = () => setState(null)
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setState(null) }
    document.addEventListener('contextmenu', onCtx)
    document.addEventListener('click', close)
    document.addEventListener('scroll', close, true)
    window.addEventListener('blur', close)
    window.addEventListener('resize', close)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('contextmenu', onCtx)
      document.removeEventListener('click', close)
      document.removeEventListener('scroll', close, true)
      window.removeEventListener('blur', close)
      window.removeEventListener('resize', close)
      document.removeEventListener('keydown', onKey)
    }
  }, [])

  if (!state) return null

  const node = state.uuid ? nodes.get(state.uuid) ?? null : null
  const dismiss = () => setState(null)

  const copy = (text: string, what: string) => {
    navigator.clipboard?.writeText(text).then(
      () => toast.addToast({ type: 'success', title: '已复制', message: what }),
      () => toast.addToast({ type: 'error', title: '复制失败' }),
    )
    dismiss()
  }

  const entries: MenuEntry[] = []
  if (node) {
    const pinned = isPinned(node.uuid)
    entries.push({ kind: 'label', label: displayName(node) })
    entries.push({ kind: 'item', label: '打开详情', icon: Eye, onClick: () => { onOpenNode(node.uuid); dismiss() } })
    entries.push({ kind: 'item', label: pinned ? '取消置顶' : '置顶', icon: pinned ? PinOff : Pin, onClick: () => { onTogglePin(node.uuid); dismiss() } })
    entries.push({ kind: 'item', label: '加入对比', icon: GitCompareArrows, onClick: () => { onToggleCompare(node.uuid); dismiss() } })
    entries.push({ kind: 'item', label: '复制名称', icon: Copy, onClick: () => copy(displayName(node), displayName(node)) })
    entries.push({ kind: 'item', label: '复制 UUID', icon: Hash, onClick: () => copy(node.uuid, node.uuid) })
    entries.push({ kind: 'divider' })
  }
  entries.push({ kind: 'item', label: '刷新数据', icon: RefreshCw, onClick: () => { onRefresh(); dismiss() } })
  entries.push({ kind: 'item', label: '卡片视图', icon: LayoutGrid, onClick: () => { onSetView('cards'); dismiss() } })
  entries.push({ kind: 'item', label: '表格视图', icon: TableIcon, onClick: () => { onSetView('table'); dismiss() } })
  entries.push({ kind: 'item', label: '地图视图', icon: Globe, onClick: () => { onSetView('map'); dismiss() } })
  entries.push({ kind: 'divider' })
  entries.push({ kind: 'item', label: '费用统计', icon: Coins, onClick: () => { onBilling(); dismiss() } })
  entries.push({ kind: 'item', label: '主题外观', icon: Palette, onClick: () => { onTheme(); dismiss() } })
  entries.push({ kind: 'divider' })
  entries.push({ kind: 'item', label: '回到顶部', icon: ArrowUp, onClick: () => { window.scrollTo({ top: 0, behavior: 'smooth' }); dismiss() } })
  entries.push({ kind: 'item', label: isFullscreen() ? '退出全屏' : '全屏显示', icon: Maximize, onClick: () => { toggleFullscreen(); dismiss() } })

  // 视口内夹取定位
  const MENU_W = 200
  const estH = entries.reduce((h, e) => h + (e.kind === 'divider' ? 9 : e.kind === 'label' ? 28 : 32), 8)
  const left = Math.min(state.x, window.innerWidth - MENU_W - 8)
  const top = Math.min(state.y, Math.max(8, window.innerHeight - estH - 8))

  return (
    <div
      ref={ref}
      className="fixed z-[80] min-w-[190px] rounded-xl border border-border/60 bg-popover/95 backdrop-blur-xl shadow-2xl py-1.5 animate-in fade-in zoom-in-95 duration-100 origin-top-left"
      style={{ left, top }}
      onClick={e => e.stopPropagation()}
      onContextMenu={e => { e.preventDefault(); e.stopPropagation() }}
    >
      {entries.map((e, i) => {
        if (e.kind === 'divider') return <div key={i} className="my-1 h-px bg-border/50" />
        if (e.kind === 'label') {
          return (
            <div key={i} className="px-3 py-1.5 text-[11px] font-medium text-muted-foreground truncate max-w-[220px]">
              {e.label}
            </div>
          )
        }
        const Icon = e.icon!
        return (
          <button
            key={i}
            onClick={e.onClick}
            className={cn(
              'w-full flex items-center gap-2.5 px-3 py-1.5 text-xs text-left transition-colors',
              'hover:bg-primary/10 hover:text-primary',
            )}
          >
            <Icon className="h-3.5 w-3.5 shrink-0 opacity-70" />
            {e.label}
          </button>
        )
      })}
    </div>
  )
}
