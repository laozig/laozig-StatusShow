import { useMemo } from 'react'
import { Activity, Wifi, WifiOff, ArrowDown, ArrowUp, Zap } from 'lucide-react'
import { bytes, pct } from '../utils/format'
import { deriveUsage } from '../utils/derive'
import { cn } from '../utils/cn'
import type { Node } from '../types'

interface Props {
  nodes: Map<string, Node>
}

export function GlobalStatusBar({ nodes }: Props) {
  const stats = useMemo(() => {
    let online = 0, offline = 0
    let netInSum = 0, netOutSum = 0
    let cpuSum = 0, cpuCount = 0

    for (const n of nodes.values()) {
      if (n.meta?.hidden) continue
      if (n.online) online++
      else offline++

      const u = deriveUsage(n)
      netInSum += u.netIn || 0
      netOutSum += u.netOut || 0
      if (u.cpu != null) { cpuSum += u.cpu; cpuCount++ }
    }

    const total = online + offline
    const health = total > 0 ? (online / total) * 100 : 0

    return { online, offline, total, netInSum, netOutSum, health, cpuCount }
  }, [nodes])

  const healthColor = stats.health >= 90
    ? 'text-emerald-400'
    : stats.health >= 70
      ? 'text-amber-400'
      : 'text-red-400'

  const healthBg = stats.health >= 90
    ? 'bg-emerald-500/10'
    : stats.health >= 70
      ? 'bg-amber-500/10'
      : 'bg-red-500/10'

  if (stats.total === 0) return null

  return (
    <div className="card-glass rounded-xl px-3 sm:px-4 py-2 sm:py-2.5 flex flex-wrap sm:flex-nowrap items-center gap-2 sm:gap-4 text-xs font-mono overflow-x-auto">
      {/* Health indicator */}
      <div className={cn('flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg shrink-0', healthBg)}>
        <Zap className={cn('h-3 sm:h-3.5 w-3 sm:w-3.5', healthColor)} />
        <span className={cn('font-bold', healthColor)}>
          {stats.health.toFixed(0)}%
        </span>
        <span className="text-muted-foreground hidden sm:inline">健康度</span>
      </div>

      {/* Divider */}
      <div className="w-px h-4 sm:h-5 bg-border shrink-0 hidden sm:block" />

      {/* Online/Offline */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        <span className="inline-flex items-center gap-1 text-emerald-400">
          <Activity className="h-3 w-3" />
          {stats.online}
        </span>
        <span className="text-muted-foreground">/</span>
        <span className="inline-flex items-center gap-1 text-red-400">
          <WifiOff className="h-3 w-3" />
          {stats.offline}
        </span>
      </div>

      <div className="w-px h-4 sm:h-5 bg-border shrink-0 hidden sm:block" />

      {/* Network speed */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        <span className="inline-flex items-center gap-1 text-cyan-400">
          <ArrowDown className="h-3 w-3" />
          {bytes(stats.netInSum)}/s
        </span>
        <span className="inline-flex items-center gap-1 text-orange-400">
          <ArrowUp className="h-3 w-3" />
          {bytes(stats.netOutSum)}/s
        </span>
      </div>

      {/* Total throughput - hide on mobile */}
      <div className="hidden sm:contents">
        <div className="w-px h-5 bg-border shrink-0" />
        <span className="text-muted-foreground shrink-0">
          ↑↓ {bytes(stats.netInSum + stats.netOutSum)}/s
        </span>
      </div>

      {/* Live dot */}
      <div className="ml-auto flex items-center gap-1.5 shrink-0">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
        </span>
        <span className="text-muted-foreground">LIVE</span>
      </div>
    </div>
  )
}
