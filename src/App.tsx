import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from './components/ui/alert'
import { useConfig } from './hooks/useConfig'
import { useNodes } from './hooks/useNodes'
import { Background } from './components/Background'
import { Navbar } from './components/Navbar'
import { Footer } from './components/Footer'
import { Announcement } from './components/Announcement'
import { GlobalStatusBar } from './components/GlobalStatusBar'
import { NetworkGauge } from './components/NetworkGauge'
import { LiveTicker } from './components/LiveTicker'
import { IpCard } from './components/IpCard'
import { BandwidthChart } from './components/BandwidthChart'
import { NodeCard } from './components/NodeCard'
import { NodeTable } from './components/NodeTable'
import { TagFilter } from './components/TagFilter'
import { RegionFilter } from './components/RegionFilter'
import { ToastProvider } from './components/Toast'
import { NodeStatusWatcher } from './components/NodeStatusWatcher'
import { useKeyboardShortcuts } from './components/KeyboardShortcuts'
import { Density, getDensityClass, initialDensity, saveDensity } from './components/DensityToggle'
import { NodeCompareBar, ComparePanel } from './components/NodeCompare'
import { ThemePanel } from './components/ThemePanel'
import { ContextMenu } from './components/ContextMenu'
import { SideRail } from './components/SideRail'
import { ScrollTop } from './components/ScrollTop'
import { useAppearance, setAppearanceDefaults, cycleMode } from './hooks/useAppearance'
import { usePins, togglePin } from './hooks/usePins'

const WorldMap = lazy(() =>
  import('./components/WorldMap').then(m => ({ default: m.WorldMap })),
)
const NodeDetail = lazy(() =>
  import('./components/NodeDetail').then(m => ({ default: m.NodeDetail })),
)
const BillingPage = lazy(() =>
  import('./components/BillingPage').then(m => ({ default: m.BillingPage })),
)
import { deriveUsage, displayName } from './utils/derive'
import type { Sort, View } from './types'

const DEFAULT_LOGO = `${import.meta.env.BASE_URL}logo.png`
const VIEW_KEY = 'nodeget.view'
const SORT_KEY = 'nodeget.sort'

function initialView(): View {
  const v = localStorage.getItem(VIEW_KEY)
  if (v === 'table' || v === 'map') return v
  return 'cards'
}

function initialSort(): Sort {
  return (localStorage.getItem(SORT_KEY) as Sort) || 'default'
}

function readHash() {
  return decodeURIComponent(window.location.hash.slice(1)) || null
}

const num = (v?: number) => (Number.isFinite(v) ? (v as number) : -Infinity)

function toBool(v: unknown, fallback = true): boolean {
  if (typeof v === 'boolean') return v
  if (typeof v === 'string') return v === 'true' || v === '1'
  return fallback
}

function AppInner() {
  const { config, error: configError } = useConfig()
  const { nodes, errors, loading, pool } = useNodes(config)

  const [view, setView] = useState<View>(initialView)
  const [sort, setSort] = useState<Sort>(initialSort)
  const [query, setQuery] = useState('')
  const [activeTag, setActiveTag] = useState<string | null>(null)
  const [activeRegion, setActiveRegion] = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(readHash)
  const [density, setDensity] = useState<Density>(initialDensity)
  const [compareMode, setCompareMode] = useState(false)
  const [compareIds, setCompareIds] = useState<string[]>([])
  const [showBilling, setShowBilling] = useState(false)
  const [themeOpen, setThemeOpen] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)

  const appearance = useAppearance()
  const pins = usePins()

  // User preferences
  const prefs = config?.user_preferences
  const showDashboard = toBool(prefs?.show_dashboard, true)
  const showPrice = toBool(prefs?.show_price, true)
  const showExpire = toBool(prefs?.show_expire, true)
  const cardStyle = appearance.card
  const showParticles = toBool(prefs?.show_particles, true)
  const announcement = prefs?.announcement || ''

  // 把 NodeGet 面板里配置的主题色/卡片风格/预设主题作为默认值注入(不覆盖访客在页内的选择)
  useEffect(() => {
    setAppearanceDefaults({
      accent: typeof prefs?.accent_color === 'string' ? prefs.accent_color : undefined,
      card: typeof prefs?.card_style === 'string' ? prefs.card_style : undefined,
      preset: typeof prefs?.theme_preset === 'string' ? prefs.theme_preset : undefined,
    })
  }, [prefs?.accent_color, prefs?.card_style, prefs?.theme_preset])

  // Persistence
  useEffect(() => { localStorage.setItem(VIEW_KEY, view) }, [view])
  useEffect(() => { localStorage.setItem(SORT_KEY, sort) }, [sort])
  useEffect(() => { saveDensity(density) }, [density])

  // 动态页面标题(站名)
  useEffect(() => {
    const name = config?.user_preferences?.site_name
    if (name) document.title = name
  }, [config?.user_preferences?.site_name])

  // Hash sync
  useEffect(() => {
    const onHash = () => setSelected(readHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  useEffect(() => {
    const target = selected ? `#${encodeURIComponent(selected)}` : ''
    if (window.location.hash === target) return
    if (selected) {
      window.location.hash = encodeURIComponent(selected)
    } else {
      history.replaceState(null, '', window.location.pathname + window.location.search)
    }
  }, [selected])

  // Keyboard shortcuts
  const toggleSearch = useCallback(() => {
    searchRef.current?.focus()
    searchRef.current?.select()
  }, [])

  useKeyboardShortcuts({
    onSearch: toggleSearch,
    onCycleTheme: cycleMode,
    onView: setView,
    onThemePanel: () => setThemeOpen(true),
    onBilling: () => setShowBilling(true),
  })

  // Auto-filter cleanup
  const allTags = useMemo(() => {
    const set = new Set<string>()
    for (const n of nodes.values()) {
      if (n.meta?.hidden) continue
      for (const t of n.meta?.tags ?? []) set.add(t)
    }
    return [...set].sort()
  }, [nodes])

  const regions = useMemo(() => {
    const map = new Map<string, number>()
    let total = 0
    for (const n of nodes.values()) {
      if (n.meta?.hidden) continue
      total++
      const code = n.meta?.region?.trim().toUpperCase()
      if (!code || !/^[A-Z]{2}$/.test(code)) continue
      map.set(code, (map.get(code) ?? 0) + 1)
    }
    const list = [...map.entries()]
      .map(([code, count]) => ({ code, count }))
      .sort((a, b) => b.count - a.count || a.code.localeCompare(b.code))
    return { list, total }
  }, [nodes])

  useEffect(() => { if (activeTag && !allTags.includes(activeTag)) setActiveTag(null) }, [allTags, activeTag])
  useEffect(() => { if (activeRegion && !regions.list.some(r => r.code === activeRegion)) setActiveRegion(null) }, [regions, activeRegion])

  const list = useMemo(() => {
    let arr = [...nodes.values()].filter(n => !n.meta?.hidden)
    if (activeTag) arr = arr.filter(n => n.meta?.tags?.includes(activeTag))
    if (activeRegion) arr = arr.filter(n => n.meta?.region?.trim().toUpperCase() === activeRegion)

    const q = query.trim().toLowerCase()
    if (q) {
      arr = arr.filter(n => {
        const hay = [
          n.uuid, n.source, n.meta?.name, n.meta?.region, n.meta?.virtualization,
          n.static?.system?.system_host_name, n.static?.system?.system_name,
          ...(n.meta?.tags ?? []),
        ].filter(Boolean).join(' ').toLowerCase()
        return hay.includes(q)
      })
    }

    const rank = new Map(regions.list.map((r, i) => [r.code, i]))

    return arr.sort((a, b) => {
      // 置顶节点永远在前
      const ap = pins.has(a.uuid) ? 0 : 1
      const bp = pins.has(b.uuid) ? 0 : 1
      if (ap !== bp) return ap - bp
      if (a.online !== b.online) return a.online ? -1 : 1
      const ua = deriveUsage(a)
      const ub = deriveUsage(b)
      let cmp = 0
      if (sort === 'cpu') cmp = num(ub.cpu) - num(ua.cpu)
      else if (sort === 'mem') cmp = num(ub.mem) - num(ua.mem)
      else if (sort === 'disk') cmp = num(ub.disk) - num(ua.disk)
      else if (sort === 'netIn') cmp = num(ub.netIn) - num(ua.netIn)
      else if (sort === 'netOut') cmp = num(ub.netOut) - num(ua.netOut)
      else if (sort === 'uptime') cmp = num(ub.uptime) - num(ua.uptime)
      else if (sort === 'price') cmp = num(b.meta?.price) - num(a.meta?.price)
      else if (sort === 'region') {
        const ar = rank.get(a.meta?.region?.trim().toUpperCase() || '') ?? Infinity
        const br = rank.get(b.meta?.region?.trim().toUpperCase() || '') ?? Infinity
        cmp = ar - br
      }
      else if (sort === 'default') cmp = (a.meta?.order ?? 0) - (b.meta?.order ?? 0)
      return cmp || displayName(a).localeCompare(displayName(b))
    })
  }, [nodes, query, activeTag, activeRegion, sort, regions, pins])

  const selectedNode = selected ? nodes.get(selected) || null : null

  // Compare toggle
  const toggleCompare = useCallback((uuid: string) => {
    setCompareIds(prev =>
      prev.includes(uuid)
        ? prev.filter(id => id !== uuid)
        : [...prev, uuid]
    )
  }, [])

  if (configError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <Alert variant="destructive" className="max-w-lg">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>加载 config.json 失败</AlertTitle>
          <AlertDescription>{String(configError.message || configError)}</AlertDescription>
        </Alert>
      </div>
    )
  }

  if (!config) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="text-sm font-mono">Loading…</span>
        </div>
      </div>
    )
  }

  const logo = config.user_preferences.site_logo || DEFAULT_LOGO
  const hasVisibleNodes = regions.total > 0
  const empty = list.length === 0
  const filterActive = Boolean(query.trim() || activeTag || activeRegion)
  const initialLoading = loading && !hasVisibleNodes
  const hasErrors = errors.length > 0

  return (
    <div className={`min-h-screen flex flex-col ${getDensityClass(density)}`}>
      <Background showParticles={showParticles} />
      <NodeStatusWatcher nodes={nodes} />
      {hasVisibleNodes && <SideRail nodes={nodes} />}

      {announcement && <Announcement text={announcement} />}

      {hasVisibleNodes && <LiveTicker nodes={nodes} />}

      <Navbar
      siteName={config.user_preferences.site_name || 'laozig 探针'}
      logo={logo}
      query={query}
      onQuery={setQuery}
      view={view}
      onView={setView}
      sort={sort}
      onSort={setSort}
      density={density}
      onDensityChange={setDensity}
      compareMode={compareMode}
      onCompareModeChange={() => { setCompareMode(m => !m); setCompareIds([]) }}
      onBilling={() => setShowBilling(true)}
      onTheme={() => setThemeOpen(true)}
      searchRef={searchRef}
    />

      <main className="flex-1 max-w-[1600px] w-full mx-auto px-4 sm:px-6 py-4 sm:py-6 space-y-4">
        {/* Global Status Bar */}
        {hasVisibleNodes && <GlobalStatusBar nodes={nodes} />}

        {/* Network Gauge + Bandwidth Chart side by side */}
        {hasVisibleNodes && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <NetworkGauge nodes={nodes} />
            <BandwidthChart nodes={nodes} />
          </div>
        )}

        {/* IP Visitor Card */}
        <IpCard />

        {/* Compare Bar */}
        {compareMode && (
          <NodeCompareBar nodes={nodes} selected={compareIds} onToggle={toggleCompare} onClear={() => setCompareIds([])} />
        )}

        {/* Compare Panel */}
        {compareMode && compareIds.length >= 2 && (
          <ComparePanel nodes={nodes} uuids={compareIds} />
        )}

        {/* Filters */}
        {hasVisibleNodes && <RegionFilter regions={regions.list} total={regions.total} active={activeRegion} onChange={setActiveRegion} />}
        {hasVisibleNodes && <TagFilter tags={allTags} active={activeTag} onChange={setActiveTag} />}

        {/* Loading */}
        {initialLoading && !hasErrors && (
          <div className="space-y-4">
            <div className="flex items-center justify-center gap-2 text-muted-foreground py-1">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span className="text-sm font-mono animate-pulse">连接后端中…</span>
            </div>
            <SkeletonGrid />
          </div>
        )}

        {!initialLoading && empty && (
          <div className="py-20 text-center text-muted-foreground">
            {filterActive ? '没有匹配当前筛选条件的节点' : '暂无节点'}
          </div>
        )}

        {/* Cards View */}
        {!empty && view === 'cards' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 stagger-children">
            {list.map(n => (
              <div key={n.uuid} className="animate-slide-up relative">
                {compareMode && (
                  <button
                    onClick={(e) => { e.preventDefault(); toggleCompare(n.uuid) }}
                    className={`absolute top-2 right-2 z-10 w-5 h-5 rounded border-2 flex items-center justify-center text-[10px] transition-colors ${
                      compareIds.includes(n.uuid)
                        ? 'bg-primary border-primary text-primary-foreground'
                        : 'border-border bg-background/80 hover:border-primary/50'
                    }`}
                  >
                    {compareIds.includes(n.uuid) ? '✓' : '+'}
                  </button>
                )}
                <NodeCard
                  node={n}
                  cardStyle={cardStyle}
                  showPrice={showPrice}
                  showExpire={showExpire}
                />
              </div>
            ))}
          </div>
        )}

        {/* Table View */}
        {!empty && view === 'table' && <NodeTable nodes={list} onOpen={setSelected} />}

        {/* Map View */}
        {!empty && view === 'map' && (
          <Suspense fallback={
            <div className="py-24 flex items-center justify-center text-sm text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> 加载地图中…
            </div>
          }>
            <WorldMap nodes={list} onOpen={setSelected} />
          </Suspense>
        )}

        {/* Errors */}
        {hasErrors && (
          <Alert variant="warning">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>{errors.length} 个后端错误</AlertTitle>
            <AlertDescription>
              <ul className="list-disc pl-5 space-y-1 mt-2">
                {errors.map((e, i) => (
                  <li key={i}>
                    <b>{e.source}</b>：{e.error instanceof Error ? e.error.message : String(e.error)}
                  </li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}
      </main>

      <Footer text={config.user_preferences.footer} repo={config.repository} dist_page={config.dist_page} />

      {selectedNode && (
        <Suspense fallback={null}>
          <NodeDetail
            node={selectedNode}
            onClose={() => setSelected(null)}
            showSource={(config.site_tokens?.length ?? 0) > 1}
            pool={pool}
          />
        </Suspense>
      )}

      {showBilling && (
        <Suspense fallback={null}>
          <BillingPage nodes={nodes} onClose={() => setShowBilling(false)} />
        </Suspense>
      )}

      <ThemePanel open={themeOpen} onClose={() => setThemeOpen(false)} />

      <ContextMenu
        nodes={nodes}
        onOpenNode={setSelected}
        onToggleCompare={(uuid) => { setCompareMode(true); toggleCompare(uuid) }}
        onTogglePin={togglePin}
        onTheme={() => setThemeOpen(true)}
        onBilling={() => setShowBilling(true)}
        onSetView={setView}
        onRefresh={() => window.location.reload()}
      />

      <ScrollTop />
    </div>
  )
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
      {Array.from({ length: 10 }).map((_, i) => (
        <div
          key={i}
          className="card-glass rounded-2xl p-4 space-y-3 animate-pulse"
          style={{ animationDelay: `${i * 70}ms` }}
        >
          <div className="flex items-center gap-2">
            <div className="h-2.5 w-2.5 rounded-full bg-muted" />
            <div className="h-3 w-24 rounded bg-muted" />
            <div className="ml-auto h-4 w-5 rounded bg-muted" />
          </div>
          <div className="h-2 w-32 rounded bg-muted/60" />
          <div className="space-y-2.5 pt-1">
            {Array.from({ length: 3 }).map((_, j) => (
              <div key={j} className="h-1.5 w-full rounded-full bg-muted/50" />
            ))}
          </div>
          <div className="pt-2 border-t border-dashed border-border/40 flex gap-3">
            <div className="h-2 w-14 rounded bg-muted/50" />
            <div className="h-2 w-14 rounded bg-muted/50" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function App() {
  return (
    <ToastProvider>
      <AppInner />
    </ToastProvider>
  )
}
