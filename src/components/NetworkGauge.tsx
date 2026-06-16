import { useMemo } from 'react'
import { ArrowDown, ArrowUp, Globe, TrendingUp, TrendingDown } from 'lucide-react'
import { bytes } from '../utils/format'
import { deriveUsage } from '../utils/derive'
import type { Node } from '../types'

interface Props {
  nodes: Map<string, Node>
}

interface PeakRecord {
  value: number
  time: number
}

// Simple running peak tracker using ref-like state
const peaks = { in: 0, out: 0, ts: Date.now() }

export function NetworkGauge({ nodes }: Props) {
  const stats = useMemo(() => {
    let netInSum = 0, netOutSum = 0
    let totalRecv = 0, totalTrans = 0

    for (const n of nodes.values()) {
      if (n.meta?.hidden) continue
      const u = deriveUsage(n)
      netInSum += u.netIn || 0
      netOutSum += u.netOut || 0
      if (n.dynamic?.total_received) totalRecv += n.dynamic.total_received
      if (n.dynamic?.total_transmitted) totalTrans += n.dynamic.total_transmitted
    }

    // Track peaks
    const now = Date.now()
    if (netInSum > peaks.in) { peaks.in = netInSum; peaks.ts = now }
    if (netOutSum > peaks.out) { peaks.out = netOutSum; peaks.ts = now }

    return {
      netInSum, netOutSum,
      totalRecv, totalTrans,
      totalTraffic: totalRecv + totalTrans,
      peakIn: peaks.in,
      peakOut: peaks.out,
    }
  }, [nodes])

  return (
    <div className="card-glass rounded-xl px-4 py-3 relative panel-arch">
      <div className="flex items-center gap-2 mb-2">
        <Globe className="h-3.5 w-3.5 text-primary" />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          网络吞吐量
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCell
          icon={<ArrowDown className="h-3 w-3 text-cyan-400" />}
          label="实时入站"
          value={`${bytes(stats.netInSum)}/s`}
          color="text-cyan-400"
        />
        <StatCell
          icon={<ArrowUp className="h-3 w-3 text-orange-400" />}
          label="实时出站"
          value={`${bytes(stats.netOutSum)}/s`}
          color="text-orange-400"
        />
        <StatCell
          icon={<TrendingUp className="h-3 w-3 text-violet-400" />}
          label="累计入站"
          value={bytes(stats.totalRecv)}
          color="text-violet-400"
        />
        <StatCell
          icon={<TrendingDown className="h-3 w-3 text-emerald-400" />}
          label="累计出站"
          value={bytes(stats.totalTrans)}
          color="text-emerald-400"
        />
      </div>

      {/* Total traffic bar */}
      <div className="mt-3 pt-2 border-t border-border/50 flex items-center justify-between text-[11px]">
        <span className="text-muted-foreground">总累计流量</span>
        <span className="font-mono font-bold text-primary">
          {bytes(stats.totalTraffic)}
        </span>
      </div>
    </div>
  )
}

function StatCell({
  icon, label, value, color
}: {
  icon: React.ReactNode
  label: string
  value: string
  color: string
}) {
  return (
    <div className="flex items-center gap-2">
      {icon}
      <div>
        <div className="text-[10px] text-muted-foreground">{label}</div>
        <div className={`font-mono font-bold text-sm ${color}`}>{value}</div>
      </div>
    </div>
  )
}
