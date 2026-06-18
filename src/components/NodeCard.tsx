import { ArrowDown, ArrowUp, ArrowDownUp, CalendarClock, Clock, Coins, Gauge, HardDrive, Network, Pin, Timer, type LucideIcon } from 'lucide-react'
import { Badge } from './ui/badge'
import { Card } from './ui/card'
import { Progress } from './ui/progress'
import { Flag } from './Flag'
import { StatusDot } from './StatusDot'
import { bytes, pct, relativeAge, uptime } from '../utils/format'
import { cpuLabel, deriveUsage, displayName, distroLogo, osLabel, virtLabel } from '../utils/derive'
import { cn, loadColor } from '../utils/cn'
import { hasCost, remainingDays } from '../utils/cost'
import { normalizeCurrency, formatMoney } from '../utils/currency'
import { usePins } from '../hooks/usePins'
import { billingText, billingClass, type BillingView } from '../hooks/useTrafficBilling'
import { streamUnlockCompactText, streamUnlockToneClass, type StreamUnlockView } from '../hooks/useStreamUnlocks'
import type { Node } from '../types'
import { memo, type ReactNode } from 'react'

interface Props {
  node: Node
  cardStyle?: string
  showPrice?: boolean
  showExpire?: boolean
  billing?: BillingView
  unlocks?: StreamUnlockView[]
}

function NodeCardInner({ node, cardStyle = 'glass', showPrice = true, showExpire = true, billing, unlocks = [] }: Props) {
  const u = deriveUsage(node)
  const tags = Array.isArray(node.meta?.tags) ? node.meta.tags : []
  const os = osLabel(node)
  const logo = distroLogo(node)
  const virt = virtLabel(node)
  const cpu = cpuLabel(node)
  const price = node.meta?.price
  const expire = node.meta?.expireTime
  const remaining = remainingDays(expire)
  const cost = hasCost(node.meta)
  const code = normalizeCurrency(node.meta?.priceUnit)
  const pinned = usePins().has(node.uuid)
  const history = Array.isArray(node.history) ? node.history : []
  const rxTotal = node.dynamic?.total_received ?? 0
  const txTotal = node.dynamic?.total_transmitted ?? 0
  const hasTraffic = rxTotal > 0 || txTotal > 0

  // 新增数据:负载 / 磁盘读写 / 进程·连接 / GPU
  const d = node.dynamic
  const load = d?.load_one != null
    ? `${d.load_one.toFixed(2)} / ${(d.load_five ?? 0).toFixed(2)} / ${(d.load_fifteen ?? 0).toFixed(2)}`
    : null
  const hasIO = d?.read_speed != null || d?.write_speed != null
  const hasConn = d?.process_count != null || d?.tcp_connections != null || d?.udp_connections != null
  const gpuName = extractGpu(node.static?.gpu)

  const cardClass = cardStyle === 'glass'
    ? 'card-glass card-shine glow-ring'
    : cardStyle === 'minimal'
      ? 'card-minimal card-shine'
      : 'card-classic card-shine'

  return (
    <a href={`#${encodeURIComponent(node.uuid)}`} data-node-uuid={node.uuid} className="block group h-full">
      <Card
        className={cn(
          cardClass,
          'card-hud relative p-4 flex flex-col gap-3.5 h-full',
          pinned && 'ring-1 ring-primary/40',
          !node.online && 'opacity-50 grayscale-[0.3]',
        )}
      >
        {/* HUD 装饰:四角 corner brackets(顶部能量线由 .card-hud::before 提供) */}
        <span className="hud-corner hud-tl" aria-hidden />
        <span className="hud-corner hud-tr" aria-hidden />
        <span className="hud-corner hud-bl" aria-hidden />
        <span className="hud-corner hud-br" aria-hidden />

        {/* Header */}
        <div className="flex items-center gap-2">
          <StatusDot online={node.online} />
          {logo && (
            <img src={logo} alt="" className="w-5 h-5 shrink-0 object-contain" loading="lazy" />
          )}
          <span className="font-semibold flex-1 min-w-0 truncate text-sm" title={displayName(node)}>
            {displayName(node)}
          </span>
          {pinned && <Pin className="h-3 w-3 text-primary shrink-0 fill-primary/30" />}
          <Flag code={node.meta?.region} className="shrink-0" />
        </div>

        {/* OS + Virt + GPU */}
        {(os || virt || gpuName) && (
          <div className="font-mono text-[11px] text-muted-foreground truncate" title={[os, virt, gpuName].filter(Boolean).join(' · ')}>
            {[os, virt, gpuName].filter(Boolean).join(' · ')}
          </div>
        )}

        {/* Metrics */}
        <div className="flex flex-col gap-2.5">
          <Metric label="CPU" value={u.cpu} sub={cpu || null} subTitle={cpu || undefined} />
          <Metric
            label="内存"
            value={u.mem}
            sub={u.memTotal ? `${bytes(u.memUsed)} / ${bytes(u.memTotal)}` : null}
          />
          <Metric
            label="磁盘"
            value={u.disk}
            sub={u.diskTotal ? `${bytes(u.diskUsed)} / ${bytes(u.diskTotal)}` : null}
          />
          {node.dynamic?.total_swap != null && node.dynamic.total_swap > 0 && (
            <Metric
              label="Swap"
              value={
                node.dynamic.used_swap != null
                  ? (node.dynamic.used_swap / node.dynamic.total_swap) * 100
                  : 0
              }
              sub={
                node.dynamic.used_swap != null
                  ? `${bytes(node.dynamic.used_swap)} / ${bytes(node.dynamic.total_swap)}`
                  : undefined
              }
            />
          )}
        </div>

        {/* CPU 趋势火花线 */}
        {history.length > 2 && (
          <CardSpark values={history.map(h => (typeof h.cpu === 'number' ? h.cpu : null))} />
        )}

        {/* Network + 总流量 + Uptime */}
        <div className="mt-auto pt-3 border-t border-dashed border-border/50 font-mono text-xs text-muted-foreground space-y-1.5">
          <div className="flex items-center gap-3 text-[13px] text-foreground/85 font-medium">
            <Stat icon={ArrowDown}>{bytes(u.netIn || 0)}/s</Stat>
            <Stat icon={ArrowUp}>{bytes(u.netOut || 0)}/s</Stat>
          </div>
          {hasTraffic && (
            <div className="flex items-center gap-1.5" title="本机累计总流量">
              <ArrowDownUp className="h-3 w-3 shrink-0" />
              <span className="text-[10px]">总流量</span>
              <span className="ml-auto tabular-nums">
                ↓ {bytes(rxTotal)}　↑ {bytes(txTotal)}
              </span>
            </div>
          )}
          {billing?.enabled && (
            <div className={cn('flex items-center gap-1.5', billingClass(billing))} title="本计费周期已用流量(traffic-billing-worker)">
              <CalendarClock className="h-3 w-3 shrink-0" />
              <span className="text-[10px]">本月</span>
              <span className="ml-auto tabular-nums">{billingText(billing)}</span>
            </div>
          )}
          {load && (
            <div className="flex items-center gap-1.5" title="负载 1/5/15 分钟">
              <Gauge className="h-3 w-3 shrink-0" />
              <span className="text-[10px]">负载</span>
              <span className="ml-auto tabular-nums">{load}</span>
            </div>
          )}
          {hasIO && (
            <div className="flex items-center gap-1.5" title="磁盘读 / 写">
              <HardDrive className="h-3 w-3 shrink-0" />
              <span className="text-[10px]">读写</span>
              <span className="ml-auto tabular-nums">
                {bytes(d?.read_speed ?? 0)}/s · {bytes(d?.write_speed ?? 0)}/s
              </span>
            </div>
          )}
          {hasConn && (
            <div className="flex items-center gap-1.5" title="进程数 · TCP/UDP 连接">
              <Network className="h-3 w-3 shrink-0" />
              <span className="text-[10px]">连接</span>
              <span className="ml-auto tabular-nums">
                {d?.process_count ?? '—'} 进程 · {d?.tcp_connections ?? '—'}/{d?.udp_connections ?? '—'}
              </span>
            </div>
          )}
          <div className="flex items-center gap-3">
            <Stat icon={Clock}>{uptime(u.uptime)}</Stat>
            <span className="ml-auto text-[10px]">{relativeAge(u.ts)}</span>
          </div>
        </div>

        {/* Price & Expiry row */}
        {(showPrice && cost || showExpire && expire) && (
          <div className="flex items-center gap-2 text-[11px] font-mono text-muted-foreground">
            {showPrice && cost && price != null && price > 0 && (
              <span className="inline-flex items-center gap-1">
                <Coins className="h-3 w-3" />
                {formatMoney(price, code)}/{node.meta?.priceCycle || 30}天
              </span>
            )}
            {showExpire && expire && (
              <span className={cn(
                'inline-flex items-center gap-1 ml-auto',
                remaining != null && remaining <= 7 && 'text-amber-500',
                remaining != null && remaining <= 0 && 'text-destructive',
              )}>
                <Timer className="h-3 w-3" />
                {remaining != null
                  ? remaining > 0
                    ? `${remaining}天`
                    : '已过期'
                  : expire
                }
              </span>
            )}
          </div>
        )}

        {/* Stream unlock */}
        {unlocks.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {unlocks.slice(0, 4).map(item => (
              <Badge
                key={item.key}
                variant="outline"
                className={cn('text-[10px] px-1.5 py-0', streamUnlockToneClass(item.status, item.message))}
                title={item.message || item.label}
              >
                {streamUnlockCompactText(item)}
              </Badge>
            ))}
          </div>
        )}

        {/* Tags */}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {tags.map(t => (
              <Badge key={t} variant="outline" className="text-[10px] px-1.5 py-0">
                {t}
              </Badge>
            ))}
          </div>
        )}
      </Card>
    </a>
  )
}

// 轮询每 2s/5s 会重建整个 nodes Map（每个 Node 都是新对象），默认浅比较必失效。
// 这里按“数据是否真的变了”来比：dynamic.timestamp 不变 + online 不变 + 元数据/解锁/账单引用不变 → 跳过重渲染。
// 不比较 node.history：它每轮 slice 都产生新引用，但只要 timestamp 没变内容就没变。
function nodeCardPropsEqual(a: Props, b: Props) {
  const x = a.node
  const y = b.node
  return (
    x.uuid === y.uuid &&
    x.online === y.online &&
    x.dynamic?.timestamp === y.dynamic?.timestamp &&
    x.meta === y.meta &&
    x.static === y.static &&
    a.unlocks === b.unlocks &&
    a.billing === b.billing &&
    a.cardStyle === b.cardStyle &&
    a.showPrice === b.showPrice &&
    a.showExpire === b.showExpire
  )
}

export const NodeCard = memo(NodeCardInner, nodeCardPropsEqual)

function extractGpu(gpu: unknown): string | null {
  if (!Array.isArray(gpu) || gpu.length === 0) return null
  const g = gpu[0] as unknown
  if (typeof g === 'string') return g
  if (g && typeof g === 'object') {
    const o = g as Record<string, unknown>
    const v = o.name ?? o.brand ?? o.model ?? o.device
    if (typeof v === 'string') return v
  }
  return null
}

function CardSpark({ values }: { values: (number | null)[] }) {
  const pts = values.filter((v): v is number => v != null)
  if (pts.length < 2) return null
  const w = 100
  const h = 40
  const min = Math.min(...pts)
  const max = Math.max(...pts)
  const range = max - min || 1
  const n = values.length
  const coords: Array<[number, number]> = []
  values.forEach((v, i) => {
    if (v == null) return
    const x = (i / (n - 1)) * w
    const y = h - ((v - min) / range) * (h - 6) - 3
    coords.push([x, y])
  })
  if (coords.length < 2) return null
  const line = coords.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const area = `${coords[0][0].toFixed(1)},${h} ${line} ${coords[coords.length - 1][0].toFixed(1)},${h}`
  const last = pts[pts.length - 1]
  const gid = `cs-${Math.round(coords[0][1] * 100)}-${n}`

  return (
    <div className="text-primary">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[9px] text-muted-foreground font-mono uppercase tracking-wider">CPU 趋势</span>
        <span className="text-[9px] font-mono text-muted-foreground tabular-nums">
          {min.toFixed(0)}–{max.toFixed(0)}% · 当前 {last.toFixed(0)}%
        </span>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="w-full h-10 block">
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity={0.28} />
            <stop offset="100%" stopColor="currentColor" stopOpacity={0} />
          </linearGradient>
        </defs>
        <polygon points={area} fill={`url(#${gid})`} stroke="none" />
        <polyline
          points={line}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          vectorEffect="non-scaling-stroke"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>
    </div>
  )
}

function Stat({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1">
      <Icon className="h-3 w-3" />
      {children}
    </span>
  )
}

function Metric({
  label,
  value,
  sub,
  subTitle,
}: {
  label: string
  value: number | undefined
  sub?: string | null
  subTitle?: string
}) {
  return (
    <div className="min-w-0">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono font-medium">{pct(value)}</span>
      </div>
      <Progress value={value} indicatorClassName={loadColor(value)} className="mt-1 h-1.5" />
      {sub && (
        <div className="font-mono text-[10px] text-muted-foreground mt-0.5 truncate" title={subTitle}>
          {sub}
        </div>
      )}
    </div>
  )
}
