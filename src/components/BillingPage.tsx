import { useMemo, useState } from 'react'
import {
  ArrowLeft, Server, Coins, AlertTriangle, Wallet,
  CalendarClock, TrendingUp, ArrowUpDown,
} from 'lucide-react'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { Flag } from './Flag'
import { displayName } from '../utils/derive'
import { hasCost, remainingDays, remainingValue } from '../utils/cost'
import { CURRENCIES, normalizeCurrency, toUSD, fromUSD, formatMoney, getCurrency } from '../utils/currency'
import { useExchangeRates } from '../hooks/useExchangeRates'
import { cn } from '../utils/cn'
import type { Node } from '../types'

interface Props {
  nodes: Map<string, Node>
  onClose: () => void
}

type SortKey = 'monthly' | 'remaining' | 'name'

// 币种分布配色(按月度成本降序对应)
const CUR_COLORS = ['#06b6d4', '#10b981', '#f59e0b', '#a855f7', '#f43f5e', '#3b82f6', '#84cc16', '#ec4899', '#14b8a6', '#f97316']

interface BillItem {
  node: Node
  name: string
  code: string       // 规范化后的原始币种
  price: number      // 原始币种金额(每周期)
  cycle: number
  monthlyUsd: number // 归一化到 USD 的月度成本
  cycleUsd: number   // 折 USD 的周期金额
  expireTime: string
  remainingDays: number | null
}

export function BillingPage({ nodes, onClose }: Props) {
  const fx = useExchangeRates()
  const { items, monthlyUsd, cycleUsd, remainingUsd, byCurrency, dominant } = useMemo(
    () => computeBilling(nodes),
    // fx.version 变化(实时汇率到位)时重算
    [nodes, fx.version],
  )

  // 默认展示币种 = 节点里最常用的那个(直观体现币种识别)
  const [displayCode, setDisplayCode] = useState(dominant)
  const [sortKey, setSortKey] = useState<SortKey>('monthly')
  const cur = getCurrency(displayCode)

  const warningCount = items.filter(i => i.remainingDays != null && i.remainingDays > 0 && i.remainingDays <= 30).length
  const expiredCount = items.filter(i => i.remainingDays != null && i.remainingDays <= 0).length
  const warningMonthlyUsd = items
    .filter(i => i.remainingDays != null && i.remainingDays > 0 && i.remainingDays <= 30)
    .reduce((s, i) => s + i.monthlyUsd, 0)

  const sorted = useMemo(() => {
    const arr = [...items]
    arr.sort((a, b) => {
      if (sortKey === 'monthly') return b.monthlyUsd - a.monthlyUsd
      if (sortKey === 'name') return a.name.localeCompare(b.name)
      // remaining: 紧急的(天数小/已过期)在前,未设置的最后
      const ad = a.remainingDays ?? Infinity
      const bd = b.remainingDays ?? Infinity
      return ad - bd
    })
    return arr
  }, [items, sortKey])

  const fmt = (usd: number, digits = 2) => formatMoney(fromUSD(usd, displayCode), displayCode, digits)

  return (
    <div className="fixed inset-0 z-50 bg-background overflow-y-auto animate-in fade-in duration-150">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-border/40 backdrop-blur bg-background/80">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="返回">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
              <Coins className="h-4 w-4" />
            </div>
            <h1 className="text-lg font-semibold">费用统计</h1>
          </div>
          <Badge variant="secondary" className="ml-auto text-[10px]">
            {items.length} 台计费
          </Badge>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {items.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            {/* 展示币种选择 */}
            <div className="flex items-center gap-2 flex-wrap">
              <Wallet className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-xs text-muted-foreground shrink-0">展示币种</span>
              <div className="flex items-center gap-1 flex-wrap">
                {CURRENCIES.map(c => (
                  <button
                    key={c.code}
                    onClick={() => setDisplayCode(c.code)}
                    title={c.name}
                    className={cn(
                      'px-2.5 py-1 rounded-lg text-xs font-mono transition-all',
                      c.code === displayCode
                        ? 'bg-primary text-primary-foreground font-bold shadow-sm shadow-primary/30'
                        : 'bg-muted text-muted-foreground hover:bg-muted/70',
                    )}
                  >
                    {c.symbol} {c.code}
                  </button>
                ))}
              </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 stagger-children">
              <StatCard
                icon={TrendingUp}
                tone="primary"
                label="月度成本"
                value={fmt(monthlyUsd)}
                sub={`年度约 ${fmt(monthlyUsd * 12, 0)}`}
                highlight
              />
              <StatCard
                icon={Wallet}
                tone="sky"
                label="周期总额"
                value={fmt(cycleUsd)}
                sub={`剩余价值 ${fmt(remainingUsd)}`}
              />
              <StatCard
                icon={CalendarClock}
                tone={warningCount > 0 ? 'amber' : 'emerald'}
                label="近期到期"
                value={String(warningCount)}
                sub={warningCount > 0 ? `约 ${fmt(warningMonthlyUsd)}/月` : '30 天内无'}
              />
              <StatCard
                icon={AlertTriangle}
                tone={expiredCount > 0 ? 'rose' : 'emerald'}
                label="已过期"
                value={String(expiredCount)}
                sub={expiredCount > 0 ? '需尽快续费' : '全部正常'}
              />
            </div>

            {/* 币种分布 —— 直接展示每个节点的真实币种 */}
            {byCurrency.length > 1 && (
              <div className="card-glass rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3 text-xs text-muted-foreground">
                  <Coins className="h-3.5 w-3.5" />
                  币种分布
                  <span className="text-[10px] ml-auto">月度成本占比 · 各节点按自身币种计</span>
                </div>
                {monthlyUsd > 0 && (
                  <div className="flex h-2 rounded-full overflow-hidden mb-3 bg-muted">
                    {byCurrency.map((b, i) => (
                      <div
                        key={b.code}
                        title={`${b.code} ${((b.monthlyUsd / monthlyUsd) * 100).toFixed(0)}%`}
                        className="transition-all"
                        style={{ width: `${(b.monthlyUsd / monthlyUsd) * 100}%`, background: CUR_COLORS[i % CUR_COLORS.length] }}
                      />
                    ))}
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  {byCurrency.map((b, i) => {
                    const c = getCurrency(b.code)
                    return (
                      <div
                        key={b.code}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/60 border border-border/50"
                      >
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: CUR_COLORS[i % CUR_COLORS.length] }} />
                        <span className="text-xs font-medium">{c.code}</span>
                        <span className="text-[10px] text-muted-foreground">{b.count} 台</span>
                        <span className="text-xs font-mono">
                          {formatMoney(b.monthlyOriginal, b.code)}/月
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Billing Table */}
            <div className="card-glass rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-border/50 flex items-center gap-2">
                <Server className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold">节点费用明细</span>
                <div className="ml-auto flex items-center gap-1">
                  <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
                  {(['monthly', 'remaining', 'name'] as SortKey[]).map(k => (
                    <button
                      key={k}
                      onClick={() => setSortKey(k)}
                      className={cn(
                        'px-2 py-0.5 rounded text-[10px] transition-colors',
                        sortKey === k
                          ? 'bg-primary/15 text-primary font-medium'
                          : 'text-muted-foreground hover:text-foreground',
                      )}
                    >
                      {k === 'monthly' ? '月度' : k === 'remaining' ? '到期' : '名称'}
                    </button>
                  ))}
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border/50 text-muted-foreground">
                      <th className="px-4 py-2.5 text-left font-medium">节点</th>
                      <th className="px-4 py-2.5 text-right font-medium">原价</th>
                      <th className="px-4 py-2.5 text-right font-medium">月度({cur.code})</th>
                      <th className="px-4 py-2.5 text-right font-medium">折合({cur.code})</th>
                      <th className="px-4 py-2.5 text-center font-medium">到期</th>
                      <th className="px-4 py-2.5 text-right font-medium w-40">剩余</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map(item => (
                      <BillRow key={item.node.uuid} item={item} displayCode={displayCode} onClose={onClose} />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Rate notice */}
            <div className="flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground font-mono">
              <span className={cn('inline-block w-1.5 h-1.5 rounded-full', fx.source === 'live' ? 'bg-emerald-500' : 'bg-amber-500')} />
              {fx.source === 'live'
                ? `实时汇率 · ${fx.updatedAt ? new Date(fx.updatedAt).toLocaleDateString() : ''}`
                : '静态估算汇率'}
              <span className="opacity-60">· 各节点按其配置币种识别 · ¥ 默认按人民币计</span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function BillRow({ item, displayCode, onClose }: { item: BillItem; displayCode: string; onClose: () => void }) {
  const days = item.remainingDays
  const cycleConv = fromUSD(item.cycleUsd, displayCode)
  const monthlyConv = fromUSD(item.monthlyUsd, displayCode)

  const urgency =
    days != null && days <= 0 ? 'expired'
      : days != null && days <= 7 ? 'critical'
        : days != null && days <= 30 ? 'warn'
          : 'ok'

  const daysClass = urgency === 'expired' || urgency === 'critical'
    ? 'text-rose-500 font-bold'
    : urgency === 'warn' ? 'text-amber-500' : 'text-foreground'

  const barColor = urgency === 'expired' ? 'bg-rose-500'
    : urgency === 'critical' ? 'bg-rose-500'
      : urgency === 'warn' ? 'bg-amber-500' : 'bg-emerald-500'

  // 剩余进度:剩余天数 / 周期(满 100%)
  const progress = days == null ? 0 : days <= 0 ? 0 : Math.min(100, (days / item.cycle) * 100)

  return (
    <tr
      className="border-b border-border/30 last:border-0 hover:bg-muted/30 transition-colors cursor-pointer"
      onClick={() => {
        window.location.hash = encodeURIComponent(item.node.uuid)
        onClose()
      }}
    >
      <td className="px-4 py-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', item.node.online ? 'bg-emerald-500' : 'bg-muted-foreground/50')} />
          <Flag code={item.node.meta?.region} className="shrink-0" />
          <span className="font-medium truncate">{item.name}</span>
        </div>
      </td>
      <td className="px-4 py-2.5 text-right whitespace-nowrap">
        {item.price > 0 ? (
          <div className="inline-flex items-center gap-1.5">
            <span className="font-mono">{formatMoney(item.price, item.code)}</span>
            <Badge variant="outline" className="text-[9px] px-1 py-0 font-mono">{item.code}</Badge>
            <span className="text-[10px] text-muted-foreground">/{item.cycle}天</span>
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>
      <td className="px-4 py-2.5 text-right font-mono text-muted-foreground">
        {item.monthlyUsd > 0 ? formatMoney(monthlyConv, displayCode) : '—'}
      </td>
      <td className="px-4 py-2.5 text-right font-mono font-bold text-primary">
        {item.cycleUsd > 0 ? formatMoney(cycleConv, displayCode) : '—'}
      </td>
      <td className="px-4 py-2.5 text-center font-mono text-[11px] text-muted-foreground whitespace-nowrap">
        {item.expireTime || '--'}
      </td>
      <td className="px-4 py-2.5">
        <div className="flex items-center justify-end gap-2">
          <div className="hidden sm:block w-16 h-1 rounded-full bg-muted overflow-hidden">
            <div className={cn('h-full rounded-full transition-all', barColor)} style={{ width: `${progress}%` }} />
          </div>
          <span className={cn('font-mono text-right w-14', daysClass)}>
            {days != null ? (days > 0 ? `${days}天` : '已过期') : '--'}
          </span>
        </div>
      </td>
    </tr>
  )
}

const TONES: Record<string, string> = {
  primary: 'text-primary',
  sky: 'text-sky-500',
  amber: 'text-amber-500',
  emerald: 'text-emerald-500',
  rose: 'text-rose-500',
}

function StatCard({
  icon: Icon, label, value, sub, tone = 'primary', highlight = false,
}: {
  icon: typeof Coins; label: string; value: string; sub?: string; tone?: string; highlight?: boolean
}) {
  const toneClass = TONES[tone] ?? TONES.primary
  return (
    <div className={cn(
      'stat-card card-glass rounded-xl p-4 animate-slide-up',
      highlight && 'ring-1 ring-primary/20',
    )}>
      <div className="flex items-center gap-2 mb-2">
        <div className={cn('p-1.5 rounded-lg bg-background/50', toneClass)}>
          <Icon className="h-3.5 w-3.5" />
        </div>
        <span className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">{label}</span>
      </div>
      <div className={cn('text-2xl sm:text-3xl font-bold tracking-tight tabular-nums', highlight ? 'text-primary' : toneClass)}>
        {value}
      </div>
      {sub && <div className="text-[10px] text-muted-foreground mt-1 font-mono truncate">{sub}</div>}
    </div>
  )
}

function EmptyState() {
  return (
    <div className="py-24 flex flex-col items-center gap-3 text-muted-foreground">
      <div className="p-4 rounded-2xl bg-muted/40">
        <Coins className="h-10 w-10 opacity-40" />
      </div>
      <p className="text-sm">暂无配置费用的节点</p>
      <p className="text-[11px] font-mono opacity-60">在 NodeGet 面板为节点设置价格与到期时间后将在此汇总</p>
    </div>
  )
}

interface CurrencyBucket {
  code: string
  count: number
  monthlyOriginal: number // 原始币种的月度成本
  monthlyUsd: number       // 折 USD 的月度成本(用于跨币种占比)
}

function computeBilling(nodes: Map<string, Node>) {
  const items: BillItem[] = []
  let monthlyUsd = 0
  let cycleUsd = 0
  let remainingUsd = 0
  const buckets = new Map<string, CurrencyBucket>()

  for (const n of nodes.values()) {
    if (n.meta?.hidden) continue
    if (!hasCost(n.meta)) continue
    const meta = n.meta
    const code = normalizeCurrency(meta.priceUnit)
    const price = meta.price > 0 ? meta.price : 0
    const cycle = meta.priceCycle > 0 ? meta.priceCycle : 30
    const usd = toUSD(price, meta.priceUnit)
    const mUsd = price > 0 ? (usd / cycle) * 30 : 0
    const remUsd = toUSD(remainingValue(meta), meta.priceUnit)

    monthlyUsd += mUsd
    cycleUsd += usd
    remainingUsd += remUsd

    if (price > 0) {
      const b = buckets.get(code) ?? { code, count: 0, monthlyOriginal: 0, monthlyUsd: 0 }
      b.count++
      b.monthlyOriginal += (price / cycle) * 30
      b.monthlyUsd += mUsd
      buckets.set(code, b)
    }

    items.push({
      node: n,
      name: displayName(n),
      code,
      price,
      cycle,
      monthlyUsd: mUsd,
      cycleUsd: usd,
      expireTime: meta.expireTime,
      remainingDays: remainingDays(meta.expireTime),
    })
  }

  const byCurrency = [...buckets.values()].sort((a, b) => b.monthlyOriginal - a.monthlyOriginal)
  const dominant = byCurrency[0]?.code ?? 'CNY'

  return { items, monthlyUsd, cycleUsd, remainingUsd, byCurrency, dominant }
}
