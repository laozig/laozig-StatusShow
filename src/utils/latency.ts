import type { LatencyType, TaskQueryResult } from '../types'

const COLORS = [
  '#3b82f6',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#06b6d4',
  '#ec4899',
  '#14b8a6',
]

export function latencyColor(name: string) {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return COLORS[h % COLORS.length]
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

export interface ChartSeries {
  name: string
  color: string
}

function forwardFill(data: ChartPoint[], names: string[]) {
  const last: Record<string, number | null> = {}
  for (const n of names) last[n] = null
  for (const pt of data) {
    for (const n of names) {
      const v = pt[n]
      if (v == null) pt[n] = last[n]
      else last[n] = v
    }
  }
}

export function buildLatencyChart(rows: TaskQueryResult[], type: LatencyType) {
  const names = seriesNames(rows)
  const series: ChartSeries[] = names.map(name => ({ name, color: latencyColor(name) }))
  const byTs = new Map<number, ChartPoint>()

  for (const r of rows) {
    const t = normalizeTs(r.timestamp)
    let pt = byTs.get(t)
    if (!pt) {
      pt = { t }
      for (const n of names) pt[n] = null
      byTs.set(t, pt)
    }
    pt[r.cron_source || '未知'] = pickValue(r, type)
  }

  const data = [...byTs.values()].sort((a, b) => a.t - b.t)
  forwardFill(data, names)
  return { data, series }
}

export interface LatencyStats {
  name: string
  color: string
  avg: number | null
  jitter: number | null
  lossRate: number
}

export function computeLatencyStats(rows: TaskQueryResult[], type: LatencyType): LatencyStats[] {
  const stats = seriesNames(rows).map<LatencyStats>(name => {
    const list = rows.filter(r => (r.cron_source || '未知') === name)
    const vals: number[] = []
    for (const r of list) {
      const v = pickValue(r, type)
      if (v != null) vals.push(v)
    }

    const color = latencyColor(name)
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
  ping: 500,
  tcp_ping: 500,
  http_ping: 2000,
}

export interface LatencyDomain {
  domain: [number, number]
  cap: number
  outliers: number
  max: number | null
}

/**
 * 固定 Y 轴上限(按类型):ping / tcp_ping = 500ms,http_ping = 2000ms。
 * 避免随数据动态缩放导致基线忽高忽低;超过上限的超时/离群点直接裁顶,
 * 并返回越界次数用于提示。
 */
export function latencyYDomain(data: ChartPoint[], names: string[], type: LatencyType): LatencyDomain {
  const cap = TYPE_Y_CAP[type] ?? 500
  const vals: number[] = []
  for (const pt of data) {
    for (const n of names) {
      const v = pt[n]
      if (typeof v === 'number') vals.push(v)
    }
  }
  const max = vals.length ? Math.max(...vals) : null
  const outliers = vals.filter(v => v > cap).length
  return { domain: [0, cap], cap, outliers, max }
}

export interface LatencyQuality {
  label: string
  tier: number // -1 未知, 0 最好 ... 4 最差
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
