import { useEffect, useMemo, useState, type ComponentType } from 'react'
import { Activity, ArrowDownUp, Server, Globe } from 'lucide-react'
import { deriveUsage } from '../utils/derive'
import { bytes } from '../utils/format'
import { cn } from '../utils/cn'
import { useAppearance } from '../hooks/useAppearance'
import type { Node } from '../types'

function useClock() {
  const [t, setT] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setT(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  return t
}

/**
 * 超宽屏(≥1750px)两侧空白处的装饰 + 实时迷你信息。
 * 窄屏完全隐藏,固定定位贴边,不抢占内容区。
 */
export function SideRail({ nodes }: { nodes: Map<string, Node> }) {
  const clock = useClock()
  const { preset } = useAppearance()
  const antique = preset === 'antique'

  const stats = useMemo(() => {
    let total = 0, online = 0, net = 0
    const countries = new Set<string>()
    for (const n of nodes.values()) {
      if (n.meta?.hidden) continue
      total++
      if (n.online) online++
      const u = deriveUsage(n)
      net += (u.netIn || 0) + (u.netOut || 0)
      const c = n.meta?.region?.trim().toUpperCase()
      if (c && /^[A-Z]{2}$/.test(c)) countries.add(c)
    }
    return { total, online, net, countries: countries.size }
  }, [nodes])

  if (stats.total === 0) return null

  return (
    <>
      {/* 左:竖排品牌 + 数据流线(古朴主题让位给左侧统计栏,隐藏)*/}
      {!antique && (
        <div className="hidden min-[1750px]:flex fixed left-3 top-1/2 -translate-y-1/2 z-20 flex-col items-center gap-4 pointer-events-none select-none">
          <div className="h-28 w-px bg-gradient-to-b from-transparent via-primary/60 to-transparent animate-pulse-glow" />
          <div
            className="text-[11px] font-mono tracking-[0.35em] text-muted-foreground/70 uppercase"
            style={{ writingMode: 'vertical-rl' }}
          >
            LAOZIG&nbsp;·&nbsp;STATUS
          </div>
          <div className="h-28 w-px bg-gradient-to-b from-transparent via-primary/60 to-transparent animate-pulse-glow" />
        </div>
      )}

      {/* 实时迷你统计 + 时钟:默认贴右;古朴主题贴左(把右侧让给诗句)*/}
      <div className={cn(
        'hidden min-[1750px]:flex fixed top-1/2 -translate-y-1/2 z-20 flex-col gap-2 w-14',
        antique ? 'left-3' : 'right-3',
      )}>
        <RailStat icon={Server} value={String(stats.total)} label="节点" />
        <RailStat icon={Activity} value={String(stats.online)} label="在线" tone="text-emerald-500" />
        <RailStat icon={Globe} value={String(stats.countries)} label="地区" />
        <RailStat icon={ArrowDownUp} value={bytes(stats.net)} label="/s" small />
        <div className="card-glass rounded-xl px-1 py-2 text-center">
          <div className="font-mono text-[10px] tabular-nums text-primary leading-tight">
            {clock.toLocaleTimeString('en-GB')}
          </div>
          <div className="text-[8px] text-muted-foreground mt-0.5">LIVE</div>
        </div>
      </div>
    </>
  )
}

function RailStat({
  icon: Icon, value, label, tone, small,
}: {
  icon: ComponentType<{ className?: string }>
  value: string
  label: string
  tone?: string
  small?: boolean
}) {
  return (
    <div className="card-glass rounded-xl px-1 py-2 flex flex-col items-center gap-0.5" title={`${label} ${value}`}>
      <Icon className={cn('h-3.5 w-3.5', tone ?? 'text-muted-foreground')} />
      <div className={cn('font-mono font-bold tabular-nums truncate max-w-full', small ? 'text-[9px]' : 'text-sm', tone)}>
        {value}
      </div>
      <div className="text-[8px] text-muted-foreground">{label}</div>
    </div>
  )
}
