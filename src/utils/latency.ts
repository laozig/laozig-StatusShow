import type { LatencyType, TaskQueryResult } from '../types'

// 深色背景友好的定性调色板:明度统一、相邻索引对比大;按来源排序索引分配,保证单图内不撞色
const PALETTE = [
  '#60a5fa', '#f472b6', '#34d399', '#fbbf24',
  '#a78bfa', '#22d3ee', '#fb923c', '#4ade80',
  '#e879f9', '#38bdf8', '#facc15', '#2dd4bf',
  '#fca5a5', '#c4b5fd', '#a3e635', '#f9a8d4',
]

export function seriesColor(index: number) {
  if (index < PALETTE.length) return PALETTE[index]
  // 超出手工色板后用 golden-angle 生成,保证更多来源也均匀不撞色
  const hue = (index * 137.508) % 360
  return `hsl(${hue.toFixed(1)}deg 68% 62%)`
}

function normalizeTs(ts: number) {
  return ts < 1_000_000_000_000 ? ts * 1000 : ts
}

function pickValue(row: TaskQueryResult, type: LatencyType): number | null {
  const v = row.task_event_result?.[type]
  return row.success && typeof v === 'number' ? v : null
}

function seriesNames(rows: TaskQueryResult[]) {
  const set = new Set<string>()
  for (const r of rows) set.add(r.cron_source || '未知')
  return [...set].sort((a, b) => a.localeCompare(b))
}

export interface ChartPoint {
  t: number
  [series: string]: number | null
}

export interface DisplayChartPoint {
  t: number
  [series: string]: number | null
}

export interface ChartSeries {
  name: string
  color: string
}

/** 构建延迟图表数据 + 丢包标记集合 */
export function buildLatencyChart(rows: TaskQueryResult[], type: LatencyType) {
  const names = seriesNames(rows)
  const series: ChartSeries[] = names.map((name, i) => ({ name, color: seriesColor(i) }))
  const byTs = new Map<number, ChartPoint>()
  const lossPoints = new Set<string>() // "t-sourceName" 格式

  for (const r of rows) {
    const t = normalizeTs(r.timestamp)
    const name = r.cron_source || '未知'
    let pt = byTs.get(t)
    if (!pt) {
      pt = { t }
      byTs.set(t, pt)
    }
    const val = pickValue(r, type)
    pt[name] = val
    // 只有 row 存在且 success=false 才是真实丢包
    if (val === null) lossPoints.add(`${t}-${name}`)
  }

  const data = [...byTs.values()].sort((a, b) => a.t - b.t)

  return { data, series, lossPoints }
}

export interface LatencyStats {
  name: string
  color: string
  avg: number | null
  jitter: number | null
  lossRate: number
}

export function computeLatencyStats(rows: TaskQueryResult[], type: LatencyType): LatencyStats[] {
  const stats = seriesNames(rows).map<LatencyStats>((name, i) => {
    const list = rows.filter(r => (r.cron_source || '未知') === name)
    const vals: number[] = []
    for (const r of list) {
      const v = pickValue(r, type)
      if (v != null) vals.push(v)
    }

    const color = seriesColor(i)
    const lossRate = list.length ? ((list.length - vals.length) / list.length) * 100 : 0
    if (!vals.length) return { name, color, avg: null, jitter: null, lossRate }

    const avg = vals.reduce((s, v) => s + v, 0) / vals.length
    const jitter =
      vals.length >= 2
        ? vals.slice(1).reduce((s, v, i) => s + Math.abs(v - vals[i]), 0) / (vals.length - 1)
        : null

    return { name, color, avg, jitter, lossRate }
  })

  return stats.sort((a, b) => {
    const av = a.avg ?? Infinity
    const bv = b.avg ?? Infinity
    if (av !== bv) return av - bv
    const aj = a.jitter ?? Infinity
    const bj = b.jitter ?? Infinity
    if (aj !== bj) return aj - bj
    return a.lossRate - b.lossRate
  })
}

const TYPE_Y_CAP: Record<LatencyType, number> = {
  ping: 2000,
  tcp_ping: 2000,
  http_ping: 5000,
}

export interface LatencyDomain {
  domain: [number, number]
  cap: number
  outliers: number
  max: number | null
}

function niceCeil(v: number, step: number) {
  return Math.ceil(v / step) * step
}

/**
 * 自适应 Y 轴上限:按"每个来源各自的 p95"取最慢来源为基准(而非所有采样混合,
 * 否则会被低延迟高频来源拉低),确保多数来源完整可见;个别离群来源由硬上限兜底。
 * 返回越界(被裁顶)采样数与峰值用于角标提示。
 */
export function latencyYDomain(data: ChartPoint[] | DisplayChartPoint[], names: string[], type: LatencyType): LatencyDomain {
  const hard = TYPE_Y_CAP[type] ?? 2000
  const step = type === 'http_ping' ? 100 : 25
  const floor = type === 'http_ping' ? 100 : 20
  const perSeriesP95: number[] = []
  let max = 0
  for (const n of names) {
    const vals: number[] = []
    for (const pt of data) {
      const v = pt[n]
      if (typeof v === 'number') {
        vals.push(v)
        if (v > max) max = v
      }
    }
    if (!vals.length) continue
    vals.sort((a, b) => a - b)
    perSeriesP95.push(vals[Math.min(vals.length - 1, Math.floor(vals.length * 0.95))])
  }
  if (!perSeriesP95.length) return { domain: [0, floor], cap: floor, outliers: 0, max: null }

  const hiP95 = Math.max(...perSeriesP95)
  const adaptive = Math.max(floor, Math.min(hard, niceCeil(hiP95 * 1.15, step)))
  let outliers = 0
  for (const pt of data) {
    for (const n of names) {
      const v = pt[n]
      if (typeof v === 'number' && v > adaptive) outliers++
    }
  }
  return { domain: [0, adaptive], cap: adaptive, outliers, max }
}

export interface LatencyQuality {
  label: string
  tier: number
  color: string
  className: string
}

/** 按延迟毫秒分级,用于配色与质量标签 */
export function latencyQuality(ms: number | null | undefined): LatencyQuality {
  if (ms == null || !Number.isFinite(ms)) {
    return { label: '无数据', tier: -1, color: '#94a3b8', className: 'text-muted-foreground' }
  }
  if (ms <= 50) return { label: '极佳', tier: 0, color: '#10b981', className: 'text-emerald-500' }
  if (ms <= 100) return { label: '良好', tier: 1, color: '#22c55e', className: 'text-green-500' }
  if (ms <= 150) return { label: '一般', tier: 2, color: '#f59e0b', className: 'text-amber-500' }
  if (ms <= 250) return { label: '较差', tier: 3, color: '#f97316', className: 'text-orange-500' }
  return { label: '很差', tier: 4, color: '#f43f5e', className: 'text-rose-500' }
}
