import { useEffect, useState } from 'react'
import { taskQuery } from '../api/methods'
import type { BackendPool } from '../api/pool'
import type { LatencyType, TaskQueryResult } from '../types'

const REFRESH_MS = 10_000
const QUERY_TIMEOUT_MS = 20_000

function clean(rows: TaskQueryResult[] | undefined): TaskQueryResult[] {
  return (rows ?? [])
    .filter(r => r.cron_source && r.cron_source !== '未知')
    .sort((a, b) => a.timestamp - b.timestamp)
}

/**
 * 查询单一延迟类型(ping / tcp_ping / http_ping)。
 * 每个延迟图各自调用一次,持有独立的时间窗口,互不联动。
 */
export function useNodeLatency(
  pool: BackendPool | null,
  source: string | null,
  uuid: string | null,
  type: LatencyType,
  windowMs: number,
) {
  const [rows, setRows] = useState<TaskQueryResult[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setRows([])

    if (!pool || !source || !uuid) return
    const entry = pool.entries.find(e => e.name === source)
    if (!entry) return

    let cancelled = false

    const fetchOnce = async () => {
      const now = Date.now()
      const window: [number, number] = [now - windowMs, now]
      setLoading(true)
      try {
        const res = await taskQuery(
          entry.client,
          [{ uuid }, { timestamp_from_to: window }, { type }],
          QUERY_TIMEOUT_MS,
        )
        if (!cancelled) setRows(clean(res))
      } catch {
        /* 单次失败保留上次数据 */
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchOnce()
    const timer = setInterval(fetchOnce, REFRESH_MS)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [pool, source, uuid, type, windowMs])

  return { rows, loading }
}
