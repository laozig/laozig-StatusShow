import { useMemo } from 'react'
import { Server, Timer, Zap } from 'lucide-react'
import { cn } from '../utils/cn'
import { remainingDays } from '../utils/cost'
import type { Node } from '../types'

interface Props {
  nodes: Map<string, Node>
}

interface StatItem {
  icon: typeof Server
  label: string
  value: string
  sub?: string
  colorClass: string
}

export function Dashboard({ nodes }: Props) {
  const stats = useMemo(() => {
    let total = 0, online = 0, offline = 0
    let expiryWarning = 0, expired = 0

    for (const n of nodes.values()) {
      if (n.meta?.hidden) continue
      total++
      if (n.online) online++
      else offline++

      if (n.meta?.expireTime) {
        const days = remainingDays(n.meta.expireTime)
        if (days != null) {
          if (days <= 0) expired++
          else if (days <= 7) expiryWarning++
        }
      }
    }

    const items: StatItem[] = [
      {
        icon: Server,
        label: '总节点',
        value: String(total),
        sub: `${online} 在线 · ${offline} 离线`,
        colorClass: 'text-blue-500',
      },
      {
        icon: Zap,
        label: '在线率',
        value: total > 0 ? `${((online / total) * 100).toFixed(1)}%` : '--',
        sub: `${online}/${total}`,
        colorClass: online > 0 ? 'text-emerald-500' : 'text-muted-foreground',
      },
    ]

    if (expiryWarning > 0 || expired > 0) {
      items.push({
        icon: Timer,
        label: '到期提醒',
        value: `${expiryWarning + expired}`,
        sub: `${expired} 已过期 · ${expiryWarning} 7天内`,
        colorClass: 'text-rose-500',
      })
    }

    return items
  }, [nodes])

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 stagger-children">
      {stats.map((s) => (
        <div
          key={s.label}
          className="stat-card card-glass rounded-xl p-3 sm:p-4 animate-slide-up hover:scale-[1.02] transition-transform duration-200"
        >
          <div className="flex items-center gap-2 mb-2">
            <div className={cn('p-1.5 rounded-lg bg-background/50', s.colorClass)}>
              <s.icon className="h-4 w-4" />
            </div>
            <span className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">
              {s.label}
            </span>
          </div>
          <div className={cn('text-xl sm:text-2xl font-bold tracking-tight', s.colorClass)}>
            {s.value}
          </div>
          {s.sub && (
            <div className="text-[10px] text-muted-foreground mt-1 font-mono">
              {s.sub}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
