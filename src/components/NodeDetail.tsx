import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import {
  Area,
  AreaChart,
  CartesianGrid,
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
  type LatencyStats,
} from '../utils/latency'
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
}

export function NodeDetail({ node, onClose, showSource, pool }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLDivElement>(null)
  const [stuck, setStuck] = useState(false)
  const [rangeIdx, setRangeIdx] = useState(1) // 默认 1 小时
  const range = LATENCY_RANGES[rangeIdx]

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

  const { pingData, tcpData, loading: latencyLoading } = useNodeLatency(
    pool,
    node?.source ?? null,
    node?.uuid ?? null,
    range.ms,
  )

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
          rows={tcpData}
          type="tcp_ping"
          loading={latencyLoading}
          rangeLabel={range.label}
          rangeIdx={rangeIdx}
          onRangeIdx={setRangeIdx}
        />
        <LatencyBlock
          title="Ping"
          rows={pingData}
          type="ping"
          loading={latencyLoading}
          rangeLabel={range.label}
          rangeIdx={rangeIdx}
          onRangeIdx={setRangeIdx}
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
  rows: TaskQueryResult[]
  type: LatencyType
  loading: boolean
  rangeLabel: string
  rangeIdx: number
  onRangeIdx: (i: number) => void
}

const ms = (v: number) => `${v.toFixed(1)} ms`
const slug = (name: string) => name.replace(/[^a-zA-Z0-9_-]/g, '_')

function lastValue(data: ReturnType<typeof buildLatencyChart>['data'], name: string): number | null {
  for (let i = data.length - 1; i >= 0; i--) {
    const v = data[i][name]
    if (typeof v === 'number') return v
  }
  return null
}

function LatencyBlock({ title, rows, type, loading, rangeLabel, rangeIdx, onRangeIdx }: LatencyBlockProps) {
  const { data, series } = useMemo(() => buildLatencyChart(rows, type), [rows, type])
  const stats = useMemo(() => computeLatencyStats(rows, type), [rows, type])
  const [hidden, setHidden] = useState<Set<string>>(() => new Set())
  const empty = data.length === 0

  const visibleSeries = series.filter(s => !hidden.has(s.name))
  const single = visibleSeries.length === 1

  const toggle = (name: string) =>
    setHidden(prev => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })

  // 头部概览:单来源取最新值,多来源取最优来源的平均
  const primaryStat = stats.find(s => !hidden.has(s.name)) ?? stats[0]
  const headline = single
    ? lastValue(data, visibleSeries[0].name)
    : (primaryStat?.avg ?? null)
  const q = latencyQuality(headline)
  const avgForRef = single ? (stats.find(s => s.name === visibleSeries[0].name)?.avg ?? null) : null

  return (
    <Section title={`${title} · 近 ${rangeLabel}`}>
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
        <div className="flex items-center gap-0.5 rounded-lg bg-muted p-0.5">
          {LATENCY_RANGES.map((r, i) => (
            <button
              key={r.short}
              onClick={() => onRangeIdx(i)}
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

      <div className="relative h-72 sm:h-80">
        {empty && (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
            {loading ? '加载中…' : `暂无 ${type} 数据`}
          </div>
        )}
        {!empty && (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                {visibleSeries.map(s => (
                  <linearGradient key={s.name} id={`lat-${slug(s.name)}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={s.color} stopOpacity={single ? 0.32 : 0.16} />
                    <stop offset="100%" stopColor={s.color} stopOpacity={0} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="hsl(var(--muted-foreground))"
                strokeOpacity={0.12}
                vertical={false}
              />
              <XAxis
                dataKey="t"
                type="number"
                domain={['dataMin', 'dataMax']}
                scale="time"
                tickFormatter={t => new Date(t).toLocaleTimeString()}
                tick={{ fontSize: 11 }}
                stroke="hsl(var(--muted-foreground))"
              />
              <YAxis
                tickFormatter={v => `${v}ms`}
                tick={{ fontSize: 11 }}
                stroke="hsl(var(--muted-foreground))"
                width={48}
                domain={['auto', 'auto']}
              />
              <Tooltip content={<LatencyTooltip />} cursor={{ stroke: 'hsl(var(--primary))', strokeOpacity: 0.3, strokeWidth: 1 }} />
              {avgForRef != null && (
                <ReferenceLine
                  y={avgForRef}
                  stroke={visibleSeries[0].color}
                  strokeDasharray="4 4"
                  strokeOpacity={0.5}
                  label={{ value: `均 ${avgForRef.toFixed(0)}ms`, fontSize: 10, fill: visibleSeries[0].color, position: 'right' }}
                />
              )}
              {visibleSeries.map(s => (
                <Area
                  key={s.name}
                  type="monotone"
                  dataKey={s.name}
                  stroke={s.color}
                  strokeWidth={single ? 2.2 : 1.6}
                  fill={single ? `url(#lat-${slug(s.name)})` : 'none'}
                  fillOpacity={single ? 1 : 0}
                  connectNulls
                  isAnimationActive={false}
                  activeDot={{ r: 4, fill: s.color, stroke: 'hsl(var(--background))', strokeWidth: 2 }}
                  dot={false}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        )}
        {!empty && loading && (
          <div className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
        )}
      </div>

      {stats.length > 0 && (
        <div className="mt-3 border-t pt-3">
          <div className="flex items-center px-2 pb-1 text-[11px] text-muted-foreground">
            <span className="flex-1">来源</span>
            <span className="hidden sm:block w-16 text-center">趋势</span>
            <span className="w-16 text-center">质量</span>
            <span className="w-20 text-right">平均</span>
            <span className="w-14 text-right">抖动</span>
            <span className="w-14 text-right">丢包</span>
          </div>
          <div className="space-y-0.5">
            {stats.map(s => (
              <LatencyStatsRow
                key={s.name}
                stat={s}
                spark={data.map(d => (typeof d[s.name] === 'number' ? (d[s.name] as number) : null))}
                hidden={hidden.has(s.name)}
                onToggle={() => toggle(s.name)}
              />
            ))}
          </div>
        </div>
      )}
    </Section>
  )
}

function LatencyTooltip({ active, payload, label }: {
  active?: boolean
  payload?: Array<{ name: string; value: number; color: string }>
  label?: number
}) {
  if (!active || !payload?.length) return null
  const rows = payload.filter(p => p.value != null).sort((a, b) => a.value - b.value)
  return (
    <div className="rounded-lg border border-border/60 bg-popover/95 backdrop-blur px-3 py-2 shadow-xl text-xs">
      <div className="text-[10px] text-muted-foreground mb-1.5 font-mono">
        {label != null ? new Date(label).toLocaleTimeString() : ''}
      </div>
      <div className="space-y-1">
        {rows.map(p => {
          const q = latencyQuality(p.value)
          return (
            <div key={p.name} className="flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ background: p.color }} />
              <span className="truncate max-w-[120px]">{p.name}</span>
              <span className="ml-auto font-mono tabular-nums" style={{ color: q.color }}>
                {p.value.toFixed(1)}ms
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
  if (pts.length < 2) return <div className="h-4 w-14" />
  const min = Math.min(...pts)
  const max = Math.max(...pts)
  const range = max - min || 1
  const w = 56
  const h = 16
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
    <svg width={w} height={h} className="overflow-visible">
      <polyline points={coords.join(' ')} fill="none" stroke={color} strokeWidth={1.25} strokeLinejoin="round" strokeLinecap="round" opacity={0.85} />
    </svg>
  )
}

function LatencyStatsRow({
  stat,
  spark,
  hidden,
  onToggle,
}: {
  stat: LatencyStats
  spark: (number | null)[]
  hidden: boolean
  onToggle: () => void
}) {
  const { name, color, avg, jitter, lossRate } = stat
  const q = latencyQuality(avg)

  return (
    <div
      onClick={onToggle}
      className={cn(
        'flex items-center px-2 py-1.5 rounded-md text-xs cursor-pointer select-none transition-opacity hover:bg-muted/60',
        hidden && 'opacity-35',
      )}
    >
      <span className="flex items-center gap-2 flex-1 min-w-0">
        <span className="inline-block w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color }} />
        <span className="truncate">{name}</span>
      </span>
      <span className="hidden sm:flex w-16 justify-center">
        <MiniSpark values={spark} color={color} />
      </span>
      <span className="w-16 text-center">
        {q.tier >= 0 && (
          <span className="px-1.5 py-0.5 rounded-full text-[10px] font-medium" style={{ background: `${q.color}1f`, color: q.color }}>
            {q.label}
          </span>
        )}
      </span>
      <span className="w-20 text-right tabular-nums font-mono" style={{ color: q.tier >= 0 ? q.color : undefined }}>
        {avg != null ? ms(avg) : '—'}
      </span>
      <span className="w-14 text-right tabular-nums font-mono text-muted-foreground">
        {jitter != null ? `${jitter.toFixed(0)}ms` : '—'}
      </span>
      <span
        className={cn(
          'w-14 text-right tabular-nums font-mono',
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
