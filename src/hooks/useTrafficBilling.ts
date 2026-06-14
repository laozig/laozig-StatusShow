import { useEffect, useRef, useState } from 'react'
import type { SiteConfig } from '../types'

// traffic-billing-worker 的 /list 返回的单节点视图
export interface BillingView {
  uuid: string
  name: string
  enabled: boolean
  mode: 'outbound' | 'inbound' | 'both'
  billing_day: number
  quota_gb: number | null
  used_bytes: number
  used_gb: number
  percent: number | null
  remaining_gb: number | null
  alerts_triggered: Record<string, boolean>
  current_period_start: number | null
  last_update: number | null
}

const ROUTE = '/nodeget/worker-route/traffic-billing/list'
const INTERVAL_MS = 30000

// 后端 backend_url 为 wss://host[/path]，worker HTTP 路由在同 host 的 https origin 下
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

const MODE_LABEL: Record<string, string> = { outbound: '出网', inbound: '入网', both: '双向' }

export function fmtGb(gb: number): string {
  if (!Number.isFinite(gb)) return '0 GB'
  return gb >= 1024 ? `${(gb / 1024).toFixed(2)} TB` : `${gb.toFixed(2)} GB`
}

// 卡片/表格展示文本:有配额 → 用量/配额·占比;不限额 → 用量·方向
export function billingText(b: BillingView): string {
  const used = fmtGb(b.used_gb || 0)
  if (b.quota_gb) return `${used} / ${fmtGb(b.quota_gb)} · ${b.percent ?? 0}%`
  return `${used} · ${MODE_LABEL[b.mode] || b.mode}`
}

// 告警着色:≥95%/已触发0.95 → 红;≥80%/已触发0.8 → 黄
export function billingClass(b: BillingView): string {
  const a = b.alerts_triggered || {}
  const over = (b.percent != null && b.percent >= 100) || a['0.95'] === true
  if (over) return 'text-rose-500'
  const warn = (b.percent != null && b.percent >= 80) || a['0.8'] === true
  return warn ? 'text-amber-500' : ''
}

// 轮询所有后端的 traffic-billing /list，按 uuid 合并为 Map
export function useTrafficBilling(config: SiteConfig | null): Map<string, BillingView> {
  const [map, setMap] = useState<Map<string, BillingView>>(new Map())
  const basesRef = useRef<string[]>([])

  useEffect(() => {
    const set = new Set<string>()
    for (const t of config?.site_tokens ?? []) {
      const b = baseFrom(t.backend_url)
      if (b) set.add(b)
    }
    basesRef.current = [...set]
    if (!basesRef.current.length) return

    let stopped = false
    const load = async () => {
      const next = new Map<string, BillingView>()
      await Promise.all(
        basesRef.current.map(async base => {
          try {
            const r = await fetch(base + ROUTE, { cache: 'no-store' })
            const d = await r.json()
            if (d && d.ok && Array.isArray(d.nodes)) {
              for (const n of d.nodes as BillingView[]) next.set(n.uuid, n)
            }
          } catch {
            /* 后端/worker 不可用时静默,保留上次数据 */
          }
        }),
      )
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
