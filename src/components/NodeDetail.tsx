import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { Card } from './ui/card'
import { Flag } from './Flag'
import { StatusDot } from './StatusDot'
import { bytes, pct, relativeAge, uptime } from '../utils/format'
import { deriveUsage, displayName, distroLogo, osLabel, virtLabel } from '../utils/derive'
import { cycleProgress, hasCost, remainingDays, remainingValue } from '../utils/cost'
import { normalizeCurrency, formatMoney } from '../utils/currency'
import { cn, strokeColor } from '../utils/cn'
import {
  buildLatencyChart,
  computeLatencyStats,
  latencyQuality,
  latencyYDomain,
  seriesColor,
  type ChartPoint,
  type ChartSeries,
  type LatencyStats,
} from '../utils/latency'
import { streamUnlockToneClass, type StreamUnlockView } from '../hooks/useStreamUnlocks'
import { useNodeLatency } from '../hooks/useNodeLatency'
import type { BackendPool } from '../api/pool'
import type { HistorySample, LatencyType, Node, NodeMeta, TaskQueryResult } from '../types'

const TOOLTIP_STYLE = {
  background: 'hsl(var(--popover))',
  border: '1px solid hsl(var(--border))',
  borderRadius: 6,
  fontSize: 11,
}

const LATENCY_RANGES = [
  { label: '30 分钟', short: '30分', ms: 30 * 60 * 1000 },
  { label: '1 小时', short: '1时', ms: 60 * 60 * 1000 },
  { label: '6 小时', short: '6时', ms: 6 * 60 * 60 * 1000 },
  { label: '24 小时', short: '24时', ms: 24 * 60 * 60 * 1000 },
]

interface Props {
  node: Node | null
  onClose: () => void
  showSource?: boolean
  pool: BackendPool | null
  unlocks?: StreamUnlockView[]
}

export function NodeDetail({ node, onClose, showSource, pool, unlocks = [] }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLDivElement>(null)
  const [stuck, setStuck] = useState(false)

  // 三个延迟图共享的「来源→颜色」映射,保证同一来源跨图同色(按来源名全局排序分配)
  const [seriesColors, setSeriesColors] = useState<Map<string, string>>(() => new Map())
  useEffect(() => {
    setSeriesColors(new Map())
  }, [node?.uuid])
  const registerSeries = useCallback((names: string[]) => {
    setSeriesColors(prev => {
      const keys = new Set(prev.keys())
      let added = false
      for (const n of names) if (!keys.has(n)) { keys.add(n); added = true }
      if (!added) return prev
      const sorted = [...keys].sort((a, b) => a.localeCompare(b))
      const next = new Map<string, string>()
      sorted.forEach((n, i) => next.set(n, seriesColor(i)))
      return next
    })
  }, [])

  useEffect(() => {
    if (!node) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [node, onClose])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    setStuck(false)
    const onScroll = () => {
      const h = headerRef.current?.offsetHeight ?? 60
      setStuck(el.scrollTop > h)
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [node])

  if (!node) return null

  const u = deriveUsage(node)
  const d = node.dynamic
  const s = node.static?.system
  const cpu = node.static?.cpu
  const tags = node.meta?.tags ?? []
  const virt = virtLabel(node)
  const logo = distroLogo(node)
  const swap =
    d?.total_swap && d.used_swap != null ? (d.used_swap / d.total_swap) * 100 : undefined
  const loadAvg =
    d?.load_one != null && d?.load_five != null && d?.load_fifteen != null
      ? `${d.load_one.toFixed(2)} / ${d.load_five.toFixed(2)} / ${d.load_fifteen.toFixed(2)}`
      : null
  const history = node.history || []

  return (
    <div
      ref={scrollRef}
      className="fixed inset-0 z-50 bg-background overflow-y-auto animate-in fade-in duration-150"
    >
      <div
        ref={headerRef}
        className={`sticky top-0 z-10 transition-[background-color,backdrop-filter,border-color] duration-200 ${
          stuck
            ? 'border-b border-border/40 backdrop-blur bg-background/70'
            : 'border-b border-transparent'
        }`}
      >
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center gap-2 sm:gap-3">
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="返回" className="shrink-0">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <StatusDot online={node.online} />
          {logo && (
            <img src={logo} alt="" className="w-5 h-5 shrink-0 object-contain" loading="lazy" />
          )}
          <span className="font-semibold truncate min-w-0">{displayName(node)}</span>
          <Flag code={node.meta?.region} className="shrink-0" />
          <span className="hidden md:inline truncate text-xs font-mono text-muted-foreground">
            {node.uuid}
          </span>
          <div className="ml-auto flex flex-wrap gap-1.5 shrink-0">
            {node.meta?.region && <Badge variant="secondary">{node.meta.region}</Badge>}
            {showSource && (
              <Badge variant="secondary" className="hidden sm:inline-flex">
                {node.source}
              </Badge>
            )}
            {virt && <Badge variant="secondary">{virt}</Badge>}
            {tags.map(t => (
              <Badge key={t} variant="outline">
                {t}
              </Badge>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-8">
        <Section title="资源">
          <div className="flex flex-wrap justify-around gap-4 sm:gap-6">
            <Ring label="CPU" value={u.cpu} sub={loadAvg ?? undefined} />
            <Ring
              label="内存"
              value={u.mem}
              sub={u.memTotal ? `${bytes(u.memUsed)} / ${bytes(u.memTotal)}` : undefined}
            />
            <Ring
              label="磁盘"
              value={u.disk}
              sub={u.diskTotal ? `${bytes(u.diskUsed)} / ${bytes(u.diskTotal)}` : undefined}
            />
            {swap != null && (
              <Ring
                label="Swap"
                value={swap}
                sub={`${bytes(d?.used_swap)} / ${bytes(d?.total_swap)}`}
              />
            )}
          </div>
        </Section>

        {history.length > 1 && (
          <Section title={`近 ${history.length * 2} 秒趋势`}>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <Spark
                data={history}
                dataKey="cpu"
                label="CPU %"
                stroke="#3b82f6"
                domain={[0, 100]}
                format={pct}
              />
              <Spark
                data={history}
                dataKey="mem"
                label="内存 %"
                stroke="#10b981"
                domain={[0, 100]}
                format={pct}
              />
              <Spark
                data={history}
                dataKey="netIn"
                label="下行"
                stroke="#8b5cf6"
                format={v => `${bytes(v)}/s`}
              />
              <Spark
                data={history}
                dataKey="netOut"
                label="上行"
                stroke="#f59e0b"
                format={v => `${bytes(v)}/s`}
              />
            </div>
          </Section>
        )}

        <LatencyBlock
          title="TCP Ping"
          type="tcp_ping"
          pool={pool}
          source={node.source ?? null}
          uuid={node.uuid}
          colorMap={seriesColors}
          onSeries={registerSeries}
        />
        <LatencyBlock
          title="Ping"
          type="ping"
          pool={pool}
          source={node.source ?? null}
          uuid={node.uuid}
          colorMap={seriesColors}
          onSeries={registerSeries}
        />
        <LatencyBlock
          title="HTTP Ping"
          type="http_ping"
          pool={pool}
          source={node.source ?? null}
          uuid={node.uuid}
          colorMap={seriesColors}
          onSeries={registerSeries}
          hideWhenEmpty
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <Section title="系统">
            <KV k="主机名" v={s?.system_host_name} />
            <KV k="操作系统" v={osLabel(node)} />
            <KV k="内核" v={s?.system_kernel || s?.system_kernel_version} />
            <KV k="CPU 架构" v={s?.arch || s?.cpu_arch} />
            <KV k="虚拟化" v={virt} />
            <KV k="CPU 型号" v={cpu?.brand || cpu?.per_core?.[0]?.brand} />
            <KV
              k="核心"
              v={
                cpu?.physical_cores != null
                  ? `${cpu.physical_cores} 物理 / ${cpu.logical_cores} 逻辑`
                  : cpu?.per_core?.length
                    ? `${cpu.per_core.length} 核`
                    : null
              }
            />
          </Section>

          <Section title="网络与负载">
            <KV k="累计接收" v={d?.total_received != null ? bytes(d.total_received) : null} />
            <KV k="累计发送" v={d?.total_transmitted != null ? bytes(d.total_transmitted) : null} />
            <KV k="磁盘读" v={d?.read_speed != null ? `${bytes(d.read_speed)}/s` : null} />
            <KV k="磁盘写" v={d?.write_speed != null ? `${bytes(d.write_speed)}/s` : null} />
            <KV k="进程数" v={d?.process_count} />
            <KV
              k="TCP / UDP"
              v={
                d?.tcp_connections != null || d?.udp_connections != null
                  ? `${d?.tcp_connections ?? '—'} / ${d?.udp_connections ?? '—'}`
                  : null
              }
            />
            <KV k="运行时长" v={uptime(d?.uptime)} />
            <KV k="数据更新" v={relativeAge(d?.timestamp)} />
          </Section>

          {hasCost(node.meta) && <CostSection meta={node.meta} />}

          {unlocks.length > 0 && (
            <Section title="流媒体解锁">
              <div className="space-y-2">
                {unlocks.map(item => (
                  <div key={item.key} className="flex items-center gap-3 text-sm py-1.5">
                    <span className="text-muted-foreground min-w-[120px]">{item.label}</span>
                    <Badge variant="outline" className={streamUnlockToneClass(item.status, item.message)}>
                      {item.status}
                    </Badge>
                    {item.region && <span className="font-mono">{item.region}</span>}
                    {item.message && <span className="text-muted-foreground truncate">{item.message}</span>}
                  </div>
                ))}
              </div>
            </Section>
          )}
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card className="p-5">
      <div className="text-xs uppercase tracking-wide text-muted-foreground mb-3">{title}</div>
      {children}
    </Card>
  )
}

function KV({ k, v }: { k: string; v: ReactNode }) {
  if (v == null || v === '') return null
  return (
    <div className="flex justify-between gap-3 text-sm py-1">
      <span className="text-muted-foreground">{k}</span>
      <span className="font-mono text-right truncate">{v}</span>
    </div>
  )
}

function Ring({ label, value, sub }: { label: string; value?: number; sub?: string }) {
  const r = 40
  const c = 2 * Math.PI * r
  const v = Math.max(0, Math.min(100, value ?? 0))
  const hasValue = Number.isFinite(value)

  return (
    <div className="flex flex-col items-center gap-2 min-w-0">
      <div className="relative w-24 h-24 sm:w-28 sm:h-28">
        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
          <circle
            cx="50" cy="50" r={r}
            fill="none" strokeWidth={8}
            className="stroke-secondary"
          />
          {hasValue && (
            <circle
              cx="50" cy="50" r={r}
              fill="none" strokeWidth={8}
              className={strokeColor(value)}
              strokeDasharray={c}
              strokeDashoffset={c - (c * v) / 100}
              strokeLinecap="round"
              style={{ transition: 'stroke-dashoffset 400ms ease' }}
            />
          )}
        </svg>
        <div className="absolute inset-0 flex items-center justify-center text-base sm:text-lg font-semibold">
          {pct(value)}
        </div>
      </div>
      <div className="text-sm font-medium">{label}</div>
      {sub && (
        <div className="text-xs font-mono text-muted-foreground truncate max-w-full" title={sub}>
          {sub}
        </div>
      )}
    </div>
  )
}

interface SparkProps {
  data: HistorySample[]
  dataKey: keyof HistorySample
  label: string
  stroke: string
  domain?: [number, number]
  format: (v: number) => string
}

function Spark({ data, dataKey, label, stroke, domain, format }: SparkProps) {
  const last = Number(data.at(-1)?.[dataKey] ?? 0)
  const id = `g-${dataKey}`
  return (
    <div className="rounded-md border bg-card/50 p-3">
      <div className="flex justify-between text-[11px] mb-1">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono">{format(last)}</span>
      </div>
      <div className="h-20">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={stroke} stopOpacity={0.35} />
                <stop offset="100%" stopColor={stroke} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="t" hide />
            <YAxis hide domain={domain ?? ['auto', 'auto']} />
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              labelFormatter={t => new Date(t).toLocaleTimeString()}
              formatter={(v: number) => [format(v), label]}
            />
            <Area
              type="monotone"
              dataKey={dataKey}
              stroke={stroke}
              strokeWidth={1.5}
              fill={`url(#${id})`}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

interface LatencyBlockProps {
  title: string
  type: LatencyType
  pool: BackendPool | null
  source: string | null
  uuid: string
  colorMap: Map<string, string>
  onSeries: (names: string[]) => void
  hideWhenEmpty?: boolean
}

const ms = (v: number) => `${v.toFixed(1)} ms`
const slug = (name: string) => name.replace(/[^a-zA-Z0-9_-]/g, '_')

/** 二分定位离 label 时间最近的一次采样 */
function nearestSample(
  arr: { t: number; v: number }[] | undefined,
  label: number,
): { t: number; v: number } | null {
  if (!arr || !arr.length) return null
  let lo = 0
  let hi = arr.length - 1
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (arr[mid].t < label) lo = mid + 1
    else hi = mid
  }
  let best = arr[lo]
  if (lo > 0 && Math.abs(arr[lo - 1].t - label) < Math.abs(best.t - label)) best = arr[lo - 1]
  return best
}

function lastValue(data: ReturnType<typeof buildLatencyChart>['data'], name: string): number | null {
  for (let i = data.length - 1; i >= 0; i--) {
    const v = data[i][name]
    if (typeof v === 'number') return v
  }
  return null
}

function LatencyBlock({ title, type, pool, source, uuid, colorMap, onSeries, hideWhenEmpty }: LatencyBlockProps) {
  const lossKey = `nodeget-loss-lines-${type}`
  const [rangeIdx, setRangeIdx] = useState(1) // 默认 1 小时,各图独立
  const [showLossLines, setShowLossLines] = useState(() => {
    try {
      return localStorage.getItem(lossKey) !== '0'
    } catch {
      return true
    }
  })
  const range = LATENCY_RANGES[rangeIdx]
  const { rows, loading } = useNodeLatency(pool, source, uuid, type, range.ms)

  const { data, series: rawSeries, lossPoints } = useMemo(() => buildLatencyChart(rows, type), [rows, type])
  const rawStats = useMemo(() => computeLatencyStats(rows, type), [rows, type])
  // 上报本图来源给上层,换取跨三图统一的配色
  useEffect(() => {
    if (rawSeries.length) onSeries(rawSeries.map(s => s.name))
  }, [rawSeries, onSeries])
  const series = useMemo(
    () => rawSeries.map(s => ({ ...s, color: colorMap.get(s.name) ?? s.color })),
    [rawSeries, colorMap],
  )
  const stats = useMemo(
    () => rawStats.map(s => ({ ...s, color: colorMap.get(s.name) ?? s.color })),
    [rawStats, colorMap],
  )
  const [hidden, setHidden] = useState<Set<string>>(() => new Set())
  const [hoveredSeries, setHoveredSeries] = useState<string | null>(null)
  const [nearSeries, setNearSeries] = useState<string | null>(null)
  const chartBoxRef = useRef<HTMLDivElement>(null)
  const empty = data.length === 0

  const visibleSeries = series.filter(s => !hidden.has(s.name))
  const focusedSeries = hoveredSeries ? visibleSeries.filter(s => s.name === hoveredSeries) : visibleSeries
  const single = focusedSeries.length === 1
  const yd = useMemo(
    () => latencyYDomain(data, focusedSeries.map(s => s.name), type),
    [data, focusedSeries, type],
  )

  // 显示值: 超出自适应上限的离群点封顶,连在顶边(不破坏曲线连续性)
  const displayData = useMemo(() => {
    const names = series.map(s => s.name)
    return data.map(pt => {
      const next: ChartPoint = { t: pt.t }
      for (const n of names) {
        const v = pt[n]
        next[n] = typeof v === 'number' ? Math.min(v, yd.cap) : v
      }
      return next
    })
  }, [data, series, yd.cap])

  // 各来源采样在不同毫秒戳上报,几乎从不落在同一个 t;
  // 为 tooltip 预建每来源升序序列,hover 时二分取"该时刻最近一次采样",从而一次性展示全部来源
  const seriesSamples = useMemo(() => {
    const m = new Map<string, { t: number; v: number }[]>()
    for (const s of series) m.set(s.name, [])
    for (const pt of data) {
      for (const s of series) {
        const v = pt[s.name]
        if (typeof v === 'number') m.get(s.name)!.push({ t: pt.t, v })
      }
    }
    return m
  }, [data, series])

  // tooltip 容差: 约单来源平均采样间隔的 2.5 倍,超出则该来源在此刻视为无数据
  const tolerance = useMemo(() => {
    if (data.length < 2) return 60_000
    const span = data[data.length - 1].t - data[0].t
    const perSeries = data.length / Math.max(1, series.length)
    return Math.max(20_000, (span / Math.max(1, perSeries)) * 2.5)
  }, [data, series.length])

  // 高亮目标: 表格行 hover(聚焦,改 Y 轴+填充) 优先于 图区 hover(仅高亮最近线)
  const active = hoveredSeries ?? nearSeries
  const activeColor = active ? visibleSeries.find(s => s.name === active)?.color ?? '#94a3b8' : null
  const activeLast = active ? lastValue(data, active) : null

  // 图区 hover: 用鼠标对应的延迟值找最近来源高亮,不改 Y 轴、不填充
  const handleChartMove = (state: any) => {
    if (!state || state.activeLabel == null) return
    const t = state.activeLabel as number
    // 鼠标对应的延迟值: 优先 Recharts 的 yValue, 否则用 chartY + plot 几何反算
    let my: number | null = typeof state.yValue === 'number' ? state.yValue : null
    if (my == null && typeof state.chartY === 'number' && chartBoxRef.current) {
      const h = chartBoxRef.current.clientHeight
      const plotH = h - 10 - 30 // 减 margin.top 与 XAxis 高度估计
      if (plotH > 0) my = yd.cap * (1 - (state.chartY - 10) / plotH)
    }
    if (my == null) return
    let best: string | null = null
    let bestD = Infinity
    for (const s of visibleSeries) {
      const near = nearestSample(seriesSamples.get(s.name), t)
      if (!near) continue
      const d = Math.abs(near.v - my)
      if (d < bestD) {
        bestD = d
        best = s.name
      }
    }
    setNearSeries(prev => (prev === best ? prev : best))
  }

  // 触屏: 容器上绑原生 touch(passive:false 才能 preventDefault 防止滑动时页面滚动)
  const touchRef = useRef({ data, cap: yd.cap, visibleSeries, seriesSamples })
  touchRef.current = { data, cap: yd.cap, visibleSeries, seriesSamples }
  useEffect(() => {
    const el = chartBoxRef.current
    if (!el) return
    const onTouch = (e: TouchEvent) => {
      const touch = e.touches[0]
      const { data, cap, visibleSeries, seriesSamples } = touchRef.current
      if (!touch || data.length === 0) return
      const rect = el.getBoundingClientRect()
      const plotLeft = 46
      const plotW = rect.width - plotLeft - 12
      const plotH = rect.height - 40
      if (plotW <= 0 || plotH <= 0) return
      const frac = Math.max(0, Math.min(1, (touch.clientX - rect.left - plotLeft) / plotW))
      const t = data[0].t + frac * (data[data.length - 1].t - data[0].t)
      const my = cap * (1 - (touch.clientY - rect.top - 10) / plotH)
      let best: string | null = null
      let bestD = Infinity
      for (const s of visibleSeries) {
        const near = nearestSample(seriesSamples.get(s.name), t)
        if (!near) continue
        const d = Math.abs(near.v - my)
        if (d < bestD) {
          bestD = d
          best = s.name
        }
      }
      setNearSeries(prev => (prev === best ? prev : best))
      if (e.type === 'touchmove') e.preventDefault()
    }
    el.addEventListener('touchstart', onTouch, { passive: false })
    el.addEventListener('touchmove', onTouch, { passive: false })
    return () => {
      el.removeEventListener('touchstart', onTouch)
      el.removeEventListener('touchmove', onTouch)
    }
  }, [])

  const toggle = (name: string) =>
    setHidden(prev => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })

  // 头部概览:单来源取最新值,多来源取最优来源的平均
  const primaryStat = stats.find(s => focusedSeries.some(v => v.name === s.name)) ?? stats[0]
  const headline = single
    ? lastValue(data, focusedSeries[0].name)
    : (primaryStat?.avg ?? null)
  const q = latencyQuality(headline)
  const avgForRef = single ? (stats.find(s => s.name === focusedSeries[0].name)?.avg ?? null) : null
  const lastT = data.length ? data[data.length - 1].t : null
  const chartHeadline = headline != null ? Math.min(headline, yd.cap) : headline
  const chartAvgForRef = avgForRef != null ? Math.min(avgForRef, yd.cap) : avgForRef

  useEffect(() => {
    try {
      localStorage.setItem(lossKey, showLossLines ? '1' : '0')
    } catch {
      // ignore storage failure
    }
  }, [lossKey, showLossLines])

  // HTTP 等可选探测:后端无该类型数据时整块隐藏
  if (hideWhenEmpty && empty && !loading) return null

  return (
    <Section title={`${title} · 近 ${range.label}`}>
      {/* 概览:当前/代表延迟 + 质量分级 + 时间范围 */}
      <div className="flex items-center justify-between flex-wrap gap-2 -mt-1 mb-3">
        <div className="flex items-baseline gap-2">
          <span
            className="text-2xl font-bold tabular-nums leading-none"
            style={{ color: q.color }}
          >
            {headline != null ? headline.toFixed(1) : '—'}
          </span>
          <span className="text-xs text-muted-foreground">ms</span>
          <span className="text-[11px] text-muted-foreground ml-1">
            {single ? '最新' : '最优均值'}
          </span>
          {q.tier >= 0 && (
            <span
              className="px-2 py-0.5 rounded-full text-[11px] font-medium ml-1"
              style={{ background: `${q.color}1f`, color: q.color }}
            >
              {q.label}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowLossLines(v => !v)}
            className={cn(
              'px-2 py-1 rounded-md text-[10px] font-medium border transition-colors',
              showLossLines
                ? 'border-rose-500/35 bg-rose-500/10 text-rose-300 hover:bg-rose-500/15'
                : 'border-border bg-muted text-muted-foreground hover:text-foreground'
            )}
            title={showLossLines ? '隐藏丢包竖线' : '显示丢包竖线'}
          >
            丢包线
          </button>
          <div className="flex items-center gap-0.5 rounded-lg bg-muted p-0.5">
            {LATENCY_RANGES.map((r, i) => (
              <button
                key={r.short}
                onClick={() => setRangeIdx(i)}
                className={cn(
                  'px-2 py-0.5 rounded-md text-[10px] font-medium transition-colors',
                  i === rangeIdx ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {r.short}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div ref={chartBoxRef} className="relative h-72 sm:h-80">
        {empty && (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
            {loading ? '加载中…' : `暂无 ${type} 数据`}
          </div>
        )}
        {!empty && (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={displayData}
              margin={{ top: 10, right: 12, left: 0, bottom: 0 }}
              onMouseMove={handleChartMove}
              onMouseLeave={() => setNearSeries(null)}
            >
              <defs>
                {visibleSeries.map(s => {
                  const isFocused = !hoveredSeries || s.name === hoveredSeries
                  return (
                    <linearGradient key={s.name} id={`lat-${slug(s.name)}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={s.color} stopOpacity={single && isFocused ? 0.28 : 0.14} />
                      <stop offset="60%" stopColor={s.color} stopOpacity={single && isFocused ? 0.08 : 0.04} />
                      <stop offset="100%" stopColor={s.color} stopOpacity={0} />
                    </linearGradient>
                  )
                })}
              </defs>
              <CartesianGrid
                strokeDasharray="2 6"
                stroke="hsl(var(--muted-foreground))"
                strokeOpacity={0.1}
                vertical={false}
              />
              <XAxis
                dataKey="t"
                type="number"
                domain={['dataMin', 'dataMax']}
                scale="time"
                tickFormatter={t => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                tickLine={false}
                axisLine={false}
                minTickGap={56}
                tickMargin={8}
              />
              <YAxis
                tickFormatter={v => `${v}ms`}
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                tickLine={false}
                axisLine={false}
                width={46}
                tickCount={5}
                domain={yd.domain}
                allowDataOverflow
              />
              <Tooltip
                content={
                  <LatencyTooltip
                    samples={seriesSamples}
                    series={visibleSeries}
                    tolerance={tolerance}
                    hovered={active}
                  />
                }
                cursor={{ stroke: 'hsl(var(--primary))', strokeOpacity: 0.2, strokeWidth: 1, strokeDasharray: '4 4' }}
                isAnimationActive={false}
              />
              {chartAvgForRef != null && (
                <ReferenceLine
                  y={chartAvgForRef}
                  stroke={visibleSeries[0].color}
                  strokeDasharray="4 4"
                  strokeOpacity={0.45}
                  label={{ value: `均 ${avgForRef.toFixed(0)}ms`, fontSize: 10, fill: visibleSeries[0].color, position: 'right' }}
                />
              )}
              {[...visibleSeries]
                .sort((a, b) => (a.name === active ? 1 : 0) - (b.name === active ? 1 : 0))
                .map(s => {
                  const isActive = s.name === active
                  const dimmed = !!active && !isActive
                  const many = visibleSeries.length > 4
                  // 高亮线加粗置顶,其余压暗;无高亮时多来源用细线避免糊成一团
                  const width = active ? (isActive ? 2.8 : 1) : single ? 2.4 : many ? 1.4 : 2
                  // 填充只在表格行聚焦(单来源)时出现,图区 hover 仅高亮不填充
                  const filled = single && s.name === hoveredSeries
                  return (
                    <Area
                      key={s.name}
                      type="monotoneX"
                      dataKey={s.name}
                      stroke={s.color}
                      strokeOpacity={dimmed ? 0.1 : 1}
                      strokeWidth={width}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      fill={filled ? `url(#lat-${slug(s.name)})` : 'none'}
                      fillOpacity={filled ? 1 : 0}
                      connectNulls
                      isAnimationActive={false}
                      activeDot={{ r: 4, fill: s.color, stroke: 'hsl(var(--background))', strokeWidth: 2 }}
                      dot={false}
                    />
                  )
                })}
              {/* 丢包标记:顶部细红线，可手动开关;跟随高亮线联动 */}
              {showLossLines && visibleSeries.map(s => {
                const isActive = s.name === active
                const dimmed = !!active && !isActive
                return data
                  .filter(pt => pt[s.name] == null && lossPoints?.has(`${pt.t}-${s.name}`))
                  .map(pt => (
                    <ReferenceLine
                      key={`loss-${s.name}-${pt.t}`}
                      x={pt.t}
                      stroke="#ef4444"
                      strokeOpacity={dimmed ? 0.07 : isActive ? 0.75 : 0.5}
                      strokeWidth={dimmed ? 0.6 : isActive ? 1.5 : 1.25}
                    />
                  ))
              })}
              {/* 当前值高亮点(单来源)*/}
              {single && lastT != null && chartHeadline != null && (
                <ReferenceDot
                  x={lastT}
                  y={chartHeadline}
                  r={3.5}
                  fill={visibleSeries[0].color}
                  stroke="hsl(var(--background))"
                  strokeWidth={2}
                  isFront
                />
              )}
            </AreaChart>
          </ResponsiveContainer>
        )}
        {!empty && active && (
          <div className="pointer-events-none absolute right-2 top-1.5 z-10 flex items-center gap-1.5 rounded-md border border-border/50 bg-popover/90 px-2 py-1 text-[11px] font-medium shadow-sm backdrop-blur">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: activeColor ?? undefined }} />
            <span className="max-w-[160px] truncate">{active}</span>
            {activeLast != null && (
              <span className="font-mono tabular-nums" style={{ color: activeColor ?? undefined }}>
                {activeLast.toFixed(1)}ms
              </span>
            )}
          </div>
        )}
        {!empty && yd.outliers > 0 && (
          <div className="pointer-events-none absolute left-11 top-0.5 rounded bg-rose-500/12 px-1.5 py-0.5 text-[10px] font-mono text-rose-400/90">
            {yd.outliers} 次超时/离群 &gt; {yd.cap}ms · 峰值 {yd.max?.toFixed(0)}ms
          </div>
        )}
        {!empty && loading && (
          <div className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
        )}
      </div>

      {stats.length > 0 && (
        <div className="mt-3 border-t pt-3">
          <div className="grid items-center px-2 pb-1 text-[11px] text-muted-foreground grid-cols-[minmax(180px,1fr)_160px_64px_80px_56px_56px] sm:grid-cols-[minmax(240px,1fr)_220px_64px_80px_56px_56px] gap-3">
            <span>来源</span>
            <span className="hidden sm:block text-center">趋势</span>
            <span className="text-center">质量</span>
            <span className="text-right">平均</span>
            <span className="text-right">抖动</span>
            <span className="text-right">丢包</span>
          </div>
          <div className="space-y-0.5">
            {stats.map(s => (
              <LatencyStatsRow
                key={s.name}
                stat={s}
                spark={data.map(d => (typeof d[s.name] === 'number' ? (d[s.name] as number) : null))}
                hidden={hidden.has(s.name)}
                hovered={hoveredSeries === s.name}
                dimmed={!!hoveredSeries && hoveredSeries !== s.name}
                onToggle={() => toggle(s.name)}
                onHover={(hover) => setHoveredSeries(hover ? s.name : null)}
              />
            ))}
          </div>
        </div>
      )}
    </Section>
  )
}

function LatencyTooltip({ active, label, samples, series, tolerance, hovered }: {
  active?: boolean
  label?: number
  samples: Map<string, { t: number; v: number }[]>
  series: ChartSeries[]
  tolerance: number
  hovered: string | null
}) {
  if (!active || label == null) return null
  // 对每个来源二分定位"离 hover 时刻最近的一次采样",一次性展示全部来源
  const rows: { name: string; color: string; value: number; near: boolean }[] = []
  for (const s of series) {
    const near = nearestSample(samples.get(s.name), label)
    if (!near) continue
    const dist = Math.abs(near.t - label)
    if (dist <= tolerance) rows.push({ name: s.name, color: s.color, value: near.v, near: dist > 2000 })
  }
  if (!rows.length) return null
  // 当前高亮来源置顶,其余按延迟升序
  rows.sort((a, b) => {
    if (a.name === hovered && b.name !== hovered) return -1
    if (b.name === hovered && a.name !== hovered) return 1
    return a.value - b.value
  })

  return (
    <div className="rounded-lg border border-border/60 bg-popover/95 backdrop-blur px-3 py-2 shadow-xl text-xs max-h-[55vh] overflow-auto">
      <div className="flex items-baseline justify-between gap-3 mb-1.5">
        <span className="text-[10px] text-muted-foreground font-mono">
          {new Date(label).toLocaleTimeString()}
        </span>
        <span className="text-[10px] text-muted-foreground">{rows.length} 来源</span>
      </div>
      <div className="space-y-1">
        {rows.map(p => {
          const q = latencyQuality(p.value)
          return (
            <div
              key={p.name}
              className={cn(
                'flex items-center gap-2 rounded px-1 -mx-1',
                hovered === p.name && 'bg-muted/70 font-semibold',
              )}
            >
              <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ background: p.color }} />
              <span className="truncate max-w-[140px]">{p.name}</span>
              <span className="ml-auto font-mono tabular-nums" style={{ color: q.color }}>
                {p.value.toFixed(1)}ms{p.near ? '~' : ''}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function MiniSpark({ values, color }: { values: (number | null)[]; color: string }) {
  const pts = values.filter((v): v is number => v != null)
  if (pts.length < 2) return <div className="h-5 w-full min-w-[160px]" />
  const min = Math.min(...pts)
  const max = Math.max(...pts)
  const range = max - min || 1
  const w = 220
  const h = 18
  // 用原始序列(含 null)定位 x,缺失点跳过
  const n = values.length
  const coords: string[] = []
  values.forEach((v, i) => {
    if (v == null) return
    const x = (i / (n - 1)) * w
    const y = h - ((v - min) / range) * (h - 2) - 1
    coords.push(`${x.toFixed(1)},${y.toFixed(1)}`)
  })
  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" height={h} className="overflow-visible w-full min-w-[160px]">
      <polyline points={coords.join(' ')} fill="none" stroke={color} strokeWidth={1.25} strokeLinejoin="round" strokeLinecap="round" opacity={0.85} />
    </svg>
  )
}

function LatencyStatsRow({
  stat,
  spark,
  hidden,
  hovered,
  dimmed,
  onToggle,
  onHover,
}: {
  stat: LatencyStats
  spark: (number | null)[]
  hidden: boolean
  hovered: boolean
  dimmed: boolean
  onToggle: () => void
  onHover: (hover: boolean) => void
}) {
  const { name, color, avg, jitter, lossRate } = stat
  const q = latencyQuality(avg)

  return (
    <div
      onClick={onToggle}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      className={cn(
        'grid items-center px-2 py-1.5 rounded-md text-xs cursor-pointer select-none transition-all hover:bg-muted/60 grid-cols-[minmax(180px,1fr)_160px_64px_80px_56px_56px] sm:grid-cols-[minmax(240px,1fr)_220px_64px_80px_56px_56px] gap-3',
        hidden && 'opacity-35',
        dimmed && 'opacity-35',
        hovered && 'bg-muted/70 ring-1 ring-border',
      )}
    >
      <span className="flex items-center gap-2 min-w-0">
        <span className="inline-block w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color }} />
        <span className="truncate">{name}</span>
      </span>
      <span className="hidden sm:flex justify-center overflow-hidden">
        <MiniSpark values={spark} color={color} />
      </span>
      <span className="text-center">
        {q.tier >= 0 && (
          <span className="px-1.5 py-0.5 rounded-full text-[10px] font-medium" style={{ background: `${q.color}1f`, color: q.color }}>
            {q.label}
          </span>
        )}
      </span>
      <span className="text-right tabular-nums font-mono" style={{ color: q.tier >= 0 ? q.color : undefined }}>
        {avg != null ? ms(avg) : '—'}
      </span>
      <span className="text-right tabular-nums font-mono text-muted-foreground">
        {jitter != null ? `${jitter.toFixed(0)}ms` : '—'}
      </span>
      <span
        className={cn(
          'text-right tabular-nums font-mono',
          lossRate >= 5 ? 'text-rose-500 font-medium' : 'text-muted-foreground',
        )}
      >
        {lossRate.toFixed(0)}%
      </span>
    </div>
  )
}

function CostSection({ meta }: { meta: NodeMeta }) {
  const days = remainingDays(meta.expireTime)
  const value = remainingValue(meta)
  const progress = cycleProgress(meta)
  const code = normalizeCurrency(meta.priceUnit)

  let daysLabel: string
  let daysClass = ''
  if (days == null) daysLabel = '未设置'
  else if (days < 0) {
    daysLabel = `已过期 ${Math.abs(days)} 天`
    daysClass = 'text-red-500'
  } else if (days <= 7) {
    daysLabel = `${days} 天`
    daysClass = 'text-red-500'
  } else if (days <= 30) {
    daysLabel = `${days} 天`
    daysClass = 'text-orange-500'
  } else {
    daysLabel = `${days} 天`
  }

  const barColor =
    days == null || days < 0
      ? 'bg-muted-foreground/40'
      : days <= 7
        ? 'bg-red-500'
        : days <= 30
          ? 'bg-orange-500'
          : 'bg-emerald-500'

  return (
    <Section title="费用">
      <KV k="月费" v={meta.price > 0 ? `${formatMoney(meta.price, code)} / ${meta.priceCycle} 天` : null} />
      <KV k="到期" v={meta.expireTime || null} />
      <KV k="剩余" v={<span className={daysClass}>{daysLabel}</span>} />
      <KV k="剩余价值" v={meta.price > 0 ? formatMoney(value, code) : null} />

      {meta.expireTime && days != null && (
        <div className="mt-3 h-1.5 w-full rounded-full bg-muted overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all', barColor)}
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </Section>
  )
}
