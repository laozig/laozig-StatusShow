import { useEffect, useRef, useState } from 'react'
import { Search as SearchIcon, X, GitCompareArrows, DollarSign, Palette } from 'lucide-react'
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
  const [stuck, setStuck] = useState(false)
  const internalRef = useRef<HTMLInputElement>(null)
  const inputRef = searchRef || internalRef
  const headerRef = useRef<HTMLElement>(null)

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

  return (
    <header
      ref={headerRef}
      className={`sticky top-0 z-10 transition-[background-color,backdrop-filter,border-color] duration-200 ${
        stuck
          ? 'border-b border-border/40 backdrop-blur bg-background/70'
          : 'border-b border-transparent'
      }`}
    >
      <div className="max-w-[1600px] mx-auto flex items-center justify-between gap-2 px-4 sm:px-6 py-3">
        <a
          href="./"
          className="flex items-center gap-2.5 min-w-0 shrink-0 group/brand"
        >
          {logo && (
            <img
              src={logo}
              alt=""
              className="w-7 h-7 rounded-lg shrink-0 ring-1 ring-border/50 group-hover/brand:ring-primary/50 transition-all"
            />
          )}
          <span className="font-bold text-base sm:text-lg tracking-wide truncate bg-gradient-to-r from-primary to-foreground bg-clip-text text-transparent group-hover/brand:from-primary group-hover/brand:to-primary transition-all">
            {siteName}
          </span>
        </a>
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <div className="hidden sm:block">
            <Search value={query} onChange={onQuery} />
          </div>
          <Button
            variant="outline"
            size="icon"
            className="sm:hidden"
            onClick={() => setSearchOpen(o => !o)}
            aria-label={searchOpen ? '关闭搜索' : '搜索'}
          >
            {searchOpen ? <X className="h-4 w-4" /> : <SearchIcon className="h-4 w-4" />}
          </Button>
          <SortMenu value={sort} onChange={onSort} />
          <ViewToggle value={view} onChange={onView} />
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
      </div>

      <div
        aria-hidden={!searchOpen}
        className={`sm:hidden overflow-hidden transition-all duration-150 ease-out ${
          searchOpen ? 'max-h-20 opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="px-4 pt-1 pb-3">
          <Search ref={inputRef} value={query} onChange={onQuery} className="w-full" />
        </div>
      </div>
    </header>
  )
}
