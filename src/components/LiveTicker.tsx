import { useMemo } from 'react'
import { Timer } from 'lucide-react'
import { deriveUsage } from '../utils/derive'
import { bytes } from '../utils/format'
import { remainingDays } from '../utils/cost'
import type { Node } from '../types'

interface Props {
  nodes: Map<string, Node>
}

export function LiveTicker({ nodes }: Props) {
  const metrics = useMemo(() => {
    let online = 0, total = 0, netIn = 0, netOut = 0
    let expiryWarning = 0, expired = 0
    for (const n of nodes.values()) {
      if (n.meta?.hidden) continue
      total++
      if (n.online) online++
      const u = deriveUsage(n)
      netIn += u.netIn || 0
      netOut += u.netOut || 0
      if (n.meta?.expireTime) {
        const days = remainingDays(n.meta.expireTime)
        if (days != null) {
          if (days <= 0) expired++
          else if (days <= 7) expiryWarning++
        }
      }
    }

    const parts = [
      `🟢 ${online}/${total} 在线`,
      `↓ ${bytes(netIn)}/s`,
      `↑ ${bytes(netOut)}/s`,
      `总计 ↑↓ ${bytes(netIn + netOut)}/s`,
    ]
    if (expiryWarning > 0 || expired > 0) {
      parts.push(`⏰ ${expiryWarning + expired} 台即将到期`)
    }
    return parts
  }, [nodes])

  if (metrics.length === 0) return null

  const tickerText = metrics.join('    ·    ')
  const doubled = `${tickerText}    ·    ${tickerText}    ·    `

  return (
    <div className="overflow-hidden border-b border-border/30 bg-background/30 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto">
        <div className="relative py-1.5">
          <div
            className="flex gap-8 whitespace-nowrap font-mono text-[11px] text-muted-foreground animate-marquee"
            style={{ width: 'max-content' }}
          >
            <span>{doubled}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
