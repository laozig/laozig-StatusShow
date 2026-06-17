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
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)
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

  const len = history.length
  const hovered = hoverIdx != null ? history[hoverIdx] : undefined
  const hoverX = hoverIdx != null && len > 1 ? (hoverIdx / (len - 1)) * 100 : 0
  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (len < 2) return
    const rect = e.currentTarget.getBoundingClientRect()
    const ratio = (e.clientX - rect.left) / rect.width
    setHoverIdx(Math.max(0, Math.min(len - 1, Math.round(ratio * (len - 1)))))
  }

  return (
    <div className="card-glass rounded-xl px-4 py-3 relative panel-arch">
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

      {/* Mini SVG chart + 鼠标移入 tooltip */}
      <div
        className="relative h-10 w-full"
        onMouseMove={onMove}
        onMouseLeave={() => setHoverIdx(null)}
      >
        <svg viewBox="0 0 100 40" className="w-full h-full" preserveAspectRatio="none">
          {/* In area */}
          <path d={areaPath(inData)} fill="hsl(189, 94%, 43%)" fillOpacity="0.1" />
          <path d={linePath(inData)} fill="none" stroke="hsl(189, 94%, 43%)" strokeWidth="1.5" />
          {/* Out area */}
          <path d={areaPath(outData)} fill="hsl(25, 95%, 53%)" fillOpacity="0.1" />
          <path d={linePath(outData)} fill="none" stroke="hsl(25, 95%, 53%)" strokeWidth="1.5" />
          {/* Hover 指示 */}
          {hovered && (
            <>
              <line x1={hoverX} y1={0} x2={hoverX} y2={40} stroke="currentColor" strokeWidth="0.5" className="text-muted-foreground/50" />
              <circle cx={hoverX} cy={40 - (hovered.in / maxVal) * 40} r="1.8" fill="hsl(189, 94%, 43%)" />
              <circle cx={hoverX} cy={40 - (hovered.out / maxVal) * 40} r="1.8" fill="hsl(25, 95%, 53%)" />
            </>
          )}
        </svg>
        {hovered && (
          <div
            className="pointer-events-none absolute -top-1 z-10 -translate-x-1/2 -translate-y-full rounded-md border border-border/60 bg-popover/95 px-2 py-1 text-[10px] font-mono shadow-lg whitespace-nowrap"
            style={{ left: `${Math.min(92, Math.max(8, hoverX))}%` }}
          >
            <div className="text-cyan-400">↓ {bytes(hovered.in)}/s</div>
            <div className="text-orange-400">↑ {bytes(hovered.out)}/s</div>
          </div>
        )}
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
