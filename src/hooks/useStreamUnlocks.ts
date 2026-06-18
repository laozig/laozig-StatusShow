import { useEffect, useState } from 'react'
import { taskQuery } from '../api/methods'
import { BackendPool } from '../api/pool'
import type { SiteConfig, TaskQueryResult } from '../types'

export interface StreamUnlockView {
  key: string
  label: string
  status: string
  region: string | null
  message: string | null
  updatedAt: number | null
}

export const STREAM_UNLOCK_TASKS = [
  'stream_unlock_youtube_ipv4',
  'stream_unlock_netflix_ipv4',
  'stream_unlock_youtube_ipv6',
  'stream_unlock_netflix_ipv6',
] as const

const STREAM_UNLOCK_QUERY_TASKS = [
  'stream_unlock_youtube_ipv4',
  'stream_unlock_netflix_ipv4_a',
  'stream_unlock_netflix_ipv4_b',
  'stream_unlock_youtube_ipv6',
  'stream_unlock_netflix_ipv6_a',
  'stream_unlock_netflix_ipv6_b',
] as const

type StreamUnlockKey = (typeof STREAM_UNLOCK_TASKS)[number]
type StreamUnlockQueryKey = (typeof STREAM_UNLOCK_QUERY_TASKS)[number]

const LABELS: Record<StreamUnlockKey, string> = {
  stream_unlock_youtube_ipv4: 'YouTube IPv4',
  stream_unlock_netflix_ipv4: 'Netflix IPv4',
  stream_unlock_youtube_ipv6: 'YouTube IPv6',
  stream_unlock_netflix_ipv6: 'Netflix IPv6',
}

const SHORT: Record<StreamUnlockKey, string> = {
  stream_unlock_youtube_ipv4: 'YT4',
  stream_unlock_netflix_ipv4: 'NF4',
  stream_unlock_youtube_ipv6: 'YT6',
  stream_unlock_netflix_ipv6: 'NF6',
}

const ROUTE = '/nodeget/worker-route/stream-unlock/results'
const INTERVAL_MS = 60_000
const QUERY_LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000
const QUERY_TIMEOUT_MS = 15_000
const QUERY_LIMIT = 200

function baseFrom(backendUrl: string): string | null {
  try {
    const u = new URL(backendUrl)
    if (u.protocol === 'wss:') u.protocol = 'https:'
    else if (u.protocol === 'ws:') u.protocol = 'http:'
    return u.origin
  } catch {
    return null
  }
}

function toText(v: unknown): string {
  if (v == null) return ''
  if (typeof v === 'string') return v
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  return ''
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v)
}

function taskOrder(key: string) {
  const i = STREAM_UNLOCK_TASKS.indexOf(key as (typeof STREAM_UNLOCK_TASKS)[number])
  return i >= 0 ? i : STREAM_UNLOCK_TASKS.length
}

export function streamUnlockShortLabel(key: string) {
  return SHORT[key as keyof typeof SHORT] || key
}

export function streamUnlockToneClass(status: string, message?: string | null) {
  const s = `${status} ${message ?? ''}`.toLowerCase()
  if (s.includes('partial') || s.includes('limited') || s.includes('original') || s.includes('only')) {
    return 'border-amber-500/35 bg-amber-500/10 text-amber-300'
  }
  if (s.includes('success') || s.includes('ok') || s.includes('pass') || s.includes('available') || s.includes('unlock')) {
    return 'border-emerald-500/35 bg-emerald-500/10 text-emerald-300'
  }
  if (s.includes('fail') || s.includes('error') || s.includes('blocked') || s.includes('none') || s.includes('deny')) {
    return 'border-rose-500/35 bg-rose-500/10 text-rose-300'
  }
  return 'border-border bg-muted text-muted-foreground'
}

export function streamUnlockCompactText(item: StreamUnlockView) {
  const region =
    item.region && item.region.toLowerCase() !== 'n/a'
      ? ` ${item.region.toUpperCase()}`
      : ''
  return `${streamUnlockShortLabel(item.key)}${region}`
}

// v6 探测“活着”的状态：解锁 / 部分 / 命中地区页（如 cn）——这些都说明机器能用 IPv6 访问外网。
const V6_ALIVE_STATUSES = new Set(['success', 'partial', 'blocked'])

// 单栈机器没有 IPv6 出口，v6 探测必然全部失败（fail/pending）。
// 这种情况下丢弃 v6 项，卡片只显示 v4；双栈机器（至少一个 v6 项是真实状态）保持原样。
function filterDeadIpv6(views: StreamUnlockView[]): StreamUnlockView[] {
  const v6 = views.filter(v => v.key.endsWith('_ipv6'))
  if (!v6.length) return views
  const hasV6 = v6.some(v => V6_ALIVE_STATUSES.has(v.status))
  return hasV6 ? views : views.filter(v => !v.key.endsWith('_ipv6'))
}

type WorkerResultItem = {
  status?: string
  region?: string | null
  timestamp?: number | null
  error?: string | null
}

type WorkerAgentRow = {
  uuid: string
  name?: string
  youtube?: {
    ipv4?: WorkerResultItem | null
    ipv6?: WorkerResultItem | null
  }
  netflix?: {
    ipv4?: WorkerResultItem | null
    ipv6?: WorkerResultItem | null
  }
}

type WorkerResultsPayload = {
  ok?: boolean
  agents?: WorkerAgentRow[]
}

type TokenWithBase = SiteConfig['site_tokens'][number] & { __base: string }

function normalizePayload(
  key: StreamUnlockKey,
  payload: Record<string, unknown>,
): StreamUnlockView | null {
  const region = toText(payload.region)
  const rawError = toText(payload.error)
  let status = toText(payload.status)
  let message = rawError || ''

  if (!status && typeof payload.blocked === 'boolean') {
    status = payload.blocked ? 'no' : 'yes'
  }
  if (!status) status = 'pending'

  if (key.startsWith('stream_unlock_youtube')) {
    if (status === 'yes') {
      status = 'success'
      if (!message) message = 'Premium available'
    } else if (status === 'noprem') {
      status = 'partial'
      if (!message) message = 'Premium unavailable'
    } else if (status === 'cn') {
      status = 'blocked'
      if (!message) message = 'China only'
    } else if (status === 'bad') {
      status = 'fail'
      if (!message) message = 'Check failed'
    } else if (status === 'pending') {
      if (!message) message = 'Pending'
    }
  } else {
    if (status === 'yes') {
      status = 'success'
      if (!message) message = 'Available'
    } else if (status === 'org') {
      status = 'partial'
      if (!message) message = 'Original only'
    } else if (status === 'bad') {
      status = 'fail'
      if (!message) message = 'Check failed'
    } else if (status === 'no') {
      status = 'blocked'
      if (!message) message = 'Blocked'
    } else if (status === 'pending') {
      if (!message) message = 'Pending'
    }
  }

  return {
    key,
    label: LABELS[key],
    status,
    region: region || null,
    message: message || null,
    updatedAt: typeof payload.timestamp === 'number' ? payload.timestamp : null,
  }
}

function extractViews(agent: WorkerAgentRow): StreamUnlockView[] {
  const views: StreamUnlockView[] = []
  const yt4 = agent.youtube?.ipv4 && normalizePayload('stream_unlock_youtube_ipv4', agent.youtube.ipv4)
  const nf4 = agent.netflix?.ipv4 && normalizePayload('stream_unlock_netflix_ipv4', agent.netflix.ipv4)
  const yt6 = agent.youtube?.ipv6 && normalizePayload('stream_unlock_youtube_ipv6', agent.youtube.ipv6)
  const nf6 = agent.netflix?.ipv6 && normalizePayload('stream_unlock_netflix_ipv6', agent.netflix.ipv6)

  if (yt4) views.push(yt4)
  if (nf4) views.push(nf4)
  if (yt6) views.push(yt6)
  if (nf6) views.push(nf6)
  return views
}

function parseExecuteJson(executeText: string): Record<string, unknown> | null {
  const lines = executeText
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)

  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const line = lines[i]
    if (!line.startsWith('{') || !line.endsWith('}')) continue
    try {
      const parsed = JSON.parse(line)
      if (isRecord(parsed)) return parsed
    } catch {
      // ignore invalid banner lines
    }
  }

  return null
}

function parseTaskPayload(row: TaskQueryResult): Record<string, unknown> | null {
  const raw = row.task_event_result
  if (!isRecord(raw)) return null

  const executeRaw = raw.execute
  if (typeof executeRaw === 'string') return parseExecuteJson(executeRaw)
  if (isRecord(executeRaw)) return executeRaw
  return null
}

function parseTaskRow(key: StreamUnlockKey, row: TaskQueryResult): StreamUnlockView | null {
  const payload = parseTaskPayload(row)
  if (!payload) return null
  return normalizePayload(key, payload)
}

function parseNetflixTaskRows(
  key: Extract<StreamUnlockKey, 'stream_unlock_netflix_ipv4' | 'stream_unlock_netflix_ipv6'>,
  rowA: TaskQueryResult | undefined,
  rowB: TaskQueryResult | undefined,
): StreamUnlockView | null {
  if (!rowA && !rowB) return null

  const tsA = Number(rowA?.timestamp || 0)
  const tsB = Number(rowB?.timestamp || 0)
  const updatedAt = Math.max(tsA, tsB) || null

  if (!rowA || !rowB) {
    return normalizePayload(key, { status: 'pending', timestamp: updatedAt })
  }

  const payloadA = parseTaskPayload(rowA)
  const payloadB = parseTaskPayload(rowB)
  if (!payloadA || !payloadB) {
    return normalizePayload(key, {
      status: 'bad',
      error: 'invalid execute result',
      timestamp: updatedAt,
    })
  }

  const errorA = toText(payloadA.error)
  const errorB = toText(payloadB.error)
  if (errorA || errorB) {
    return normalizePayload(key, {
      status: 'bad',
      error: [errorA, errorB].filter(Boolean).join(' | '),
      timestamp: updatedAt,
    })
  }

  const blockedA = payloadA.blocked === true
  const blockedB = payloadB.blocked === true
  const region = toText(payloadB.region) || toText(payloadA.region) || null

  if (blockedA && blockedB) {
    return normalizePayload(key, { status: 'org', region, timestamp: updatedAt })
  }

  return normalizePayload(key, { status: 'yes', region, timestamp: updatedAt })
}

function mergeViews(next: Map<string, StreamUnlockView[]>, uuid: string, views: StreamUnlockView[]) {
  const current = next.get(uuid) ? [...(next.get(uuid) ?? [])] : []

  for (const view of views) {
    const idx = current.findIndex(item => item.key === view.key)
    if (idx < 0) current.push(view)
    else if ((view.updatedAt ?? 0) >= (current[idx].updatedAt ?? 0)) current[idx] = view
  }

  current.sort((a, b) => taskOrder(a.key) - taskOrder(b.key))
  next.set(uuid, current)
}

async function loadFromRoute(base: string, next: Map<string, StreamUnlockView[]>) {
  const r = await fetch(base + ROUTE, { cache: 'no-store' })
  if (r.status === 401 || r.status === 403) return false
  if (!r.ok) throw new Error(`stream-unlock route ${r.status}`)

  const d = (await r.json()) as WorkerResultsPayload
  if (!d?.ok || !Array.isArray(d.agents)) return true

  for (const agent of d.agents) {
    if (!agent?.uuid) continue
    const views = extractViews(agent)
    if (views.length) mergeViews(next, agent.uuid, views)
  }

  return true
}

function latestByUuid(rows: TaskQueryResult[]) {
  const latest = new Map<string, TaskQueryResult>()
  for (const row of rows) {
    if (!row?.uuid) continue
    const prev = latest.get(row.uuid)
    if (!prev || row.timestamp > prev.timestamp) latest.set(row.uuid, row)
  }
  return latest
}

async function queryLatestByUuid(
  client: BackendPool['entries'][number]['client'],
  cronSource: StreamUnlockQueryKey,
  since: number,
) {
  const rows = await taskQuery(
    client,
    [
      { cron_source: cronSource },
      { type: 'execute' },
      { timestamp_from: since },
      { limit: QUERY_LIMIT },
    ],
    QUERY_TIMEOUT_MS,
  )
  return latestByUuid(rows)
}

async function loadFromTaskQuery(tokens: TokenWithBase[], next: Map<string, StreamUnlockView[]>) {
  if (!tokens.length) return

  const pool = new BackendPool(tokens)
  const since = Date.now() - QUERY_LOOKBACK_MS

  try {
    await Promise.all(
      pool.entries.map(async entry => {
        const [yt4Rows, nf4aRows, nf4bRows, yt6Rows, nf6aRows, nf6bRows] = await Promise.all([
          queryLatestByUuid(entry.client, 'stream_unlock_youtube_ipv4', since),
          queryLatestByUuid(entry.client, 'stream_unlock_netflix_ipv4_a', since),
          queryLatestByUuid(entry.client, 'stream_unlock_netflix_ipv4_b', since),
          queryLatestByUuid(entry.client, 'stream_unlock_youtube_ipv6', since),
          queryLatestByUuid(entry.client, 'stream_unlock_netflix_ipv6_a', since),
          queryLatestByUuid(entry.client, 'stream_unlock_netflix_ipv6_b', since),
        ])

        const uuids = new Set<string>([
          ...yt4Rows.keys(),
          ...nf4aRows.keys(),
          ...nf4bRows.keys(),
          ...yt6Rows.keys(),
          ...nf6aRows.keys(),
          ...nf6bRows.keys(),
        ])

        for (const uuid of uuids) {
          const views: StreamUnlockView[] = []
          const yt4 = yt4Rows.get(uuid)
          const nf4a = nf4aRows.get(uuid)
          const nf4b = nf4bRows.get(uuid)
          const yt6 = yt6Rows.get(uuid)
          const nf6a = nf6aRows.get(uuid)
          const nf6b = nf6bRows.get(uuid)

          if (yt4) {
            const view = parseTaskRow('stream_unlock_youtube_ipv4', yt4)
            if (view) views.push(view)
          }

          {
            const view = parseNetflixTaskRows('stream_unlock_netflix_ipv4', nf4a, nf4b)
            if (view) views.push(view)
          }

          if (yt6) {
            const view = parseTaskRow('stream_unlock_youtube_ipv6', yt6)
            if (view) views.push(view)
          }

          {
            const view = parseNetflixTaskRows('stream_unlock_netflix_ipv6', nf6a, nf6b)
            if (view) views.push(view)
          }

          if (views.length) mergeViews(next, uuid, views)
        }
      }),
    )
  } finally {
    pool.close()
  }
}

export function useStreamUnlocks(config: SiteConfig | null): Map<string, StreamUnlockView[]> {
  const [map, setMap] = useState<Map<string, StreamUnlockView[]>>(new Map())

  useEffect(() => {
    const tokens: TokenWithBase[] = []
    const bases = new Set<string>()

    for (const t of config?.site_tokens ?? []) {
      const b = baseFrom(t.backend_url)
      if (!b) continue
      bases.add(b)
      tokens.push({ ...t, __base: b })
    }

    if (!bases.size) {
      setMap(new Map())
      return
    }

    let stopped = false
    const load = async () => {
      const next = new Map<string, StreamUnlockView[]>()
      const fallbackBases = new Set<string>()

      await Promise.all(
        [...bases].map(async base => {
          try {
            const ok = await loadFromRoute(base, next)
            if (!ok) fallbackBases.add(base)
          } catch {
            fallbackBases.add(base)
          }
        }),
      )

      const fallbackTokens = tokens.filter(token => fallbackBases.has(token.__base))
      try {
        await loadFromTaskQuery(fallbackTokens, next)
      } catch {
        // task_query fallback 失败时保留已有 route 数据
      }

      for (const [uuid, views] of next) next.set(uuid, filterDeadIpv6(views))
      if (!stopped && next.size) setMap(next)
    }

    load()
    const timer = setInterval(load, INTERVAL_MS)
    return () => {
      stopped = true
      clearInterval(timer)
    }
  }, [config])

  return map
}
