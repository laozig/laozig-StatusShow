import { useEffect } from 'react'
import type { View } from '../types'

interface Props {
  onSearch: () => void
  onCycleTheme: () => void
  onView: (v: View) => void
  onThemePanel: () => void
  onBilling: () => void
}

/**
 * 全局键盘快捷键。在输入框内不触发(除 Esc)。
 *   /  或 ⌘/Ctrl+K → 聚焦搜索
 *   1 / 2 / 3       → 卡片 / 表格 / 地图
 *   t               → 主题外观面板
 *   b               → 费用统计
 *   Shift+D         → 切换明暗
 */
export function useKeyboardShortcuts({ onSearch, onCycleTheme, onView, onThemePanel, onBilling }: Props) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const t = e.target
      if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement) return
      if (e.altKey) return

      // 搜索
      if (((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') || (e.key === '/' && !e.ctrlKey && !e.metaKey)) {
        e.preventDefault()
        onSearch()
        return
      }
      if (e.ctrlKey || e.metaKey) return

      switch (e.key) {
        case '1': onView('cards'); break
        case '2': onView('table'); break
        case '3': onView('map'); break
        case 't': case 'T': onThemePanel(); break
        case 'b': case 'B': onBilling(); break
        case 'D': if (e.shiftKey) onCycleTheme(); break
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onSearch, onCycleTheme, onView, onThemePanel, onBilling])
}

export function KeyboardHint() {
  return (
    <div className="hidden lg:flex items-center gap-2 text-[10px] text-muted-foreground font-mono shrink-0">
      <kbd className="px-1.5 py-0.5 rounded border bg-muted text-[10px]">⌘K</kbd>
      <span>搜索</span>
    </div>
  )
}
