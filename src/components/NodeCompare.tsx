import { useState, useCallback } from 'react'
import { GitCompareArrows, X, ChevronDown, ChevronUp } from 'lucide-react'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { Card } from './ui/card'
import { deriveUsage, displayName } from '../utils/derive'
import { bytes, pct, uptime } from '../utils/format'
import { loadColor, cn } from '../utils/cn'
import type { Node } from '../types'

interface Props {
  nodes: Map<string, Node>
  selected: string[]
  onToggle: (uuid: string) => void
  onClear: () => void
}

export function NodeCompareBar({ nodes, selected, onToggle, onClear }: Props) {
  if (selected.length === 0) return null

  return (
    <div className="card-glass rounded-xl px-4 py-2.5 flex items-center gap-3 text-xs animate-slide-up">
      <GitCompareArrows className="h-3.5 w-3.5 text-primary shrink-0" />
      <span className="text-muted-foreground shrink-0">对比中</span>
      <div className="flex flex-wrap gap-1.5 flex-1">
        {selected.map(uuid => {
          const node = nodes.get(uuid)
          if (!node) return null
          return (
            <Badge
              key={uuid}
              variant="secondary"
              className="gap-1 cursor-pointer hover:bg-destructive/20 transition-colors"
              onClick={() => onToggle(uuid)}
            >
              {displayName(node)}
              <X className="h-2.5 w-2.5" />
            </Badge>
          )
        })}
      </div>
      <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={onClear}>
        清除
      </Button>
    </div>
  )
}

export function ComparePanel({ nodes, uuids }: { nodes: Map<string, Node>; uuids: string[] }) {
  if (uuids.length < 2) return null

  const data = uuids.map(uuid => {
    const node = nodes.get(uuid)
    if (!node) return null
    const u = deriveUsage(node)
    const d = node.dynamic
    return { node, uuid, usage: u, dynamic: d }
  }).filter(Boolean) as Array<{ node: Node; uuid: string; usage: ReturnType<typeof deriveUsage>; dynamic: Node['dynamic'] }>

  if (data.length < 2) return null

  const fields = [
    { label: '状态', render: (d: typeof data[0]) => d.node.online ? '🟢 在线' : '🔴 离线' },
    { label: 'CPU', render: (d: typeof data[0]) => pct(d.usage.cpu) },
    { label: '内存', render: (d: typeof data[0]) => pct(d.usage.mem) },
    { label: '内存用量', render: (d: typeof data[0]) => `${bytes(d.usage.memUsed)} / ${bytes(d.usage.memTotal)}` },
    { label: '磁盘', render: (d: typeof data[0]) => pct(d.usage.disk) },
    { label: '磁盘用量', render: (d: typeof data[0]) => `${bytes(d.usage.diskUsed)} / ${bytes(d.usage.diskTotal)}` },
    { label: '下行', render: (d: typeof data[0]) => `${bytes(d.usage.netIn || 0)}/s` },
    { label: '上行', render: (d: typeof data[0]) => `${bytes(d.usage.netOut || 0)}/s` },
    { label: '在线时长', render: (d: typeof data[0]) => uptime(d.usage.uptime) },
    { label: '地区', render: (d: typeof data[0]) => d.node.meta?.region || '--' },
  ]

  return (
    <div className="card-glass rounded-xl overflow-hidden animate-slide-up">
      <div className="px-4 py-3 border-b border-border/50">
        <div className="flex items-center gap-2">
          <GitCompareArrows className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">节点对比</span>
          <Badge variant="secondary" className="text-[10px]">{data.length} 节点</Badge>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border/50">
              <th className="px-4 py-2 text-left text-muted-foreground font-medium">指标</th>
              {data.map(d => (
                <th key={d.uuid} className="px-4 py-2 text-left font-medium">
                  {displayName(d.node)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {fields.map(f => (
              <tr key={f.label} className="border-b border-border/30 last:border-0">
                <td className="px-4 py-2 text-muted-foreground">{f.label}</td>
                {data.map(d => (
                  <td key={d.uuid} className="px-4 py-2 font-mono">{f.render(d)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
