import { useMemo, useRef, useEffect, useState } from 'react'
import { ArrowDown, ArrowUp, TrendingUp } from 'lucide-react'
import { bytes } from '../utils/format'
import { deriveUsage } from '../utils/derive'
import type { Node } from '../types'

interface Props {
  nodes: Map<string, Node>
}

interface Sample {
  t: number
  in: number
  out: number
}

export function BandwidthChart({ nodes }: Props) {
  const [history, setHistory] = useState<Sample[]>([])
  const maxPoints = 30

  const current = useMemo(() => {
    let netIn = 0, netOut = 0
    for (const n of nodes.values()) {
      if (n.meta?.hidden) continue
      const u = deriveUsage(n)
      netIn += u.netIn || 0
      netOut += u.netOut || 0
    }
    return { netIn, netOut }
  }, [nodes])

  useEffect(() => {
    const now = Date.now()
    setHistory(prev => {
      const next = [...prev, { t: now, in: current.netIn, out: current.netOut }]
      return next.slice(-maxPoints)
    })
  }, [current])

  const maxVal = Math.max(...history.map(h => Math.max(h.in, h.out)), 1)

  // SVG path generators
  const linePath = (data: number[]) => {
    if (data.length < 2) return ''
    const w = 100
    const h = 40
    const step = w / (data.length - 1)
    return data.map((v, i) => {
      const x = i * step
      const y = h - (v / maxVal) * h
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`
    }).join(' ')
  }

  const areaPath = (data: number[]) => {
    const line = linePath(data)
    if (!line) return ''
    const w = 100
    const h = 40
    return `${line} L ${w} ${h} L 0 ${h} Z`
  }

  const inData = history.map(h => h.in)
  const outData = history.map(h => h.out)

  return (
    <div className="card-glass rounded-xl px-4 py-3">
      <div className="flex items-center gap-2 mb-3">
        <TrendingUp className="h-3.5 w-3.5 text-primary" />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          实时带宽
        </span>
      </div>

      <div className="flex items-center gap-4 mb-3">
        <div className="flex items-center gap-2">
          <ArrowDown className="h-3 w-3 text-cyan-400" />
          <span className="font-mono font-bold text-sm text-cyan-400">{bytes(current.netIn)}/s</span>
        </div>
        <div className="flex items-center gap-2">
          <ArrowUp className="h-3 w-3 text-orange-400" />
          <span className="font-mono font-bold text-sm text-orange-400">{bytes(current.netOut)}/s</span>
        </div>
      </div>

      {/* Mini SVG chart */}
      <div className="h-10 w-full">
        <svg viewBox="0 0 100 40" className="w-full h-full" preserveAspectRatio="none">
          {/* In area */}
          <path d={areaPath(inData)} fill="hsl(189, 94%, 43%)" fillOpacity="0.1" />
          <path d={linePath(inData)} fill="none" stroke="hsl(189, 94%, 43%)" strokeWidth="1.5" />
          {/* Out area */}
          <path d={areaPath(outData)} fill="hsl(25, 95%, 53%)" fillOpacity="0.1" />
          <path d={linePath(outData)} fill="none" stroke="hsl(25, 95%, 53%)" strokeWidth="1.5" />
        </svg>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-2 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-cyan-500" />
          入站
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-orange-500" />
          出站
        </span>
        <span className="ml-auto font-mono">
          {history.length} 采样点
        </span>
      </div>
    </div>
  )
}
