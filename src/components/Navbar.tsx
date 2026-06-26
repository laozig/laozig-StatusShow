import { useEffect, useRef, useState } from 'react'
import { Search as SearchIcon, X, GitCompareArrows, DollarSign, Palette, MoreHorizontal } from 'lucide-react'
import { Search } from './Search'
import { ViewToggle } from './ViewToggle'
import { ThemeToggle } from './ThemeToggle'
import { SortMenu } from './SortMenu'
import { DensityToggle, type Density } from './DensityToggle'
import { KeyboardHint } from './KeyboardShortcuts'
import { Button } from './ui/button'
import type { Sort, View } from '../types'

interface Props {
  siteName: string
  logo?: string
  query: string
  onQuery: (v: string) => void
  view: View
  onView: (v: View) => void
  sort: Sort
  onSort: (v: Sort) => void
  density: Density
  onDensityChange: (v: Density) => void
  compareMode: boolean
  onCompareModeChange: () => void
  onBilling: () => void
  onTheme: () => void
  searchRef?: React.RefObject<HTMLInputElement>
}

export function Navbar({
  siteName, logo, query, onQuery, view, onView, sort, onSort,
  density, onDensityChange, compareMode, onCompareModeChange, onBilling, onTheme, searchRef
}: Props) {
  const [searchOpen, setSearchOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const [stuck, setStuck] = useState(false)
  const internalRef = useRef<HTMLInputElement>(null)
  const inputRef = searchRef || internalRef
  const headerRef = useRef<HTMLElement>(null)
  const moreRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (searchOpen) inputRef.current?.focus()
  }, [searchOpen])

  useEffect(() => {
    const onScroll = () => {
      const h = headerRef.current?.offsetHeight ?? 60
      setStuck(window.scrollY > h)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    if (!moreOpen) return
    const onClick = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as HTMLElement)) {
        setMoreOpen(false)
      }
    }
    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [moreOpen])

  return (
    <header
      ref={headerRef}
      className={`sticky top-0 z-10 transition-[background-color,backdrop-filter,border-color] duration-200 ${
        stuck
          ? 'border-b border-border/40 backdrop-blur bg-background/70'
          : 'border-b border-transparent'
      }`}
    >
      <div className="max-w-[1600px] mx-auto flex items-center justify-between gap-2 px-3 sm:px-6 py-2 sm:py-3">
        <a
          href="./"
          className="flex items-center gap-2 sm:gap-2.5 min-w-0 shrink-0 group/brand"
        >
          {logo && (
            <img
              src={logo}
              alt=""
              className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg shrink-0 ring-1 ring-border/50 group-hover/brand:ring-primary/50 transition-all"
            />
          )}
          <span className="brand-title font-bold text-sm sm:text-lg tracking-wide truncate bg-gradient-to-r from-primary to-foreground bg-clip-text text-transparent group-hover/brand:from-primary group-hover/brand:to-primary transition-all">
            {siteName}
          </span>
        </a>
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          <div className="hidden sm:block">
            <Search value={query} onChange={onQuery} />
          </div>
          <Button
            variant="outline"
            size="icon"
            className="sm:hidden h-8 w-8"
            onClick={() => setSearchOpen(o => !o)}
            aria-label={searchOpen ? '关闭搜索' : '搜索'}
          >
            {searchOpen ? <X className="h-4 w-4" /> : <SearchIcon className="h-4 w-4" />}
          </Button>
          <div className="hidden sm:block">
            <SortMenu value={sort} onChange={onSort} />
          </div>
          <ViewToggle value={view} onChange={onView} />
          {/* 桌面端显示全部按钮 */}
          <div className="hidden sm:contents">
            <DensityToggle value={density} onChange={onDensityChange} />
            <Button
              variant={compareMode ? 'default' : 'outline'}
              size="icon"
              onClick={onCompareModeChange}
              aria-label="对比模式"
              title="对比模式"
            >
              <GitCompareArrows className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={onBilling}
              aria-label="费用统计"
              title="费用统计"
            >
              <DollarSign className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={onTheme}
              aria-label="主题外观"
              title="主题外观"
            >
              <Palette className="h-4 w-4" />
            </Button>
            <ThemeToggle />
            <KeyboardHint />
          </div>
          {/* 手机端：更多按钮 */}
          <div className="relative sm:hidden" ref={moreRef}>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setMoreOpen(o => !o)}
              aria-label="更多"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
            {moreOpen && (
              <div className="absolute right-0 top-full mt-1 flex flex-wrap items-center gap-1 p-1.5 rounded-xl border border-border bg-popover shadow-lg z-20 animate-fade-in max-w-[200px]">
                <SortMenu value={sort} onChange={onSort} />
                <ThemeToggle />
                <DensityToggle value={density} onChange={onDensityChange} />
                <Button
                  variant={compareMode ? 'default' : 'outline'}
                  size="icon"
                  onClick={() => { onCompareModeChange(); setMoreOpen(false) }}
                  aria-label="对比模式"
                  title="对比模式"
                >
                  <GitCompareArrows className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => { onBilling(); setMoreOpen(false) }}
                  aria-label="费用统计"
                  title="费用统计"
                >
                  <DollarSign className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => { onTheme(); setMoreOpen(false) }}
                  aria-label="主题外观"
                  title="主题外观"
                >
                  <Palette className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div
        aria-hidden={!searchOpen}
        className={`sm:hidden overflow-hidden transition-all duration-150 ease-out ${
          searchOpen ? 'max-h-20 opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="px-3 pt-1 pb-2">
          <Search ref={inputRef} value={query} onChange={onQuery} className="w-full" />
        </div>
      </div>
    </header>
  )
}
