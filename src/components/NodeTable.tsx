import { Badge } from './ui/badge'
import { Card } from './ui/card'
import { Progress } from './ui/progress'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table'
import { Flag } from './Flag'
import { bytes, pct, relativeAge, uptime } from '../utils/format'
import { deriveUsage, displayName, distroLogo, osLabel, virtLabel } from '../utils/derive'
import { normalizeCurrency, formatMoney } from '../utils/currency'
import { cn, loadColor } from '../utils/cn'
import type { Node } from '../types'

interface Props {
  nodes: Node[]
  onOpen?: (uuid: string) => void
}

export function NodeTable({ nodes, onOpen }: Props) {
  return (
    <>
      {/* 桌面:表格 */}
      <Card className="overflow-hidden card-glass hidden md:block">
        <div className="overflow-x-auto">
          <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-border/50">
              <TableHead className="w-[72px] text-[11px] uppercase tracking-wider">状态</TableHead>
              <TableHead className="text-[11px] uppercase tracking-wider">名称</TableHead>
              <TableHead className="w-12 text-center text-[11px] uppercase tracking-wider">地区</TableHead>
              <TableHead className="hidden lg:table-cell text-[11px] uppercase tracking-wider">系统</TableHead>
              <TableHead className="hidden xl:table-cell text-[11px] uppercase tracking-wider">架构</TableHead>
              <TableHead className="text-[11px] uppercase tracking-wider">CPU</TableHead>
              <TableHead className="text-[11px] uppercase tracking-wider">内存</TableHead>
              <TableHead className="text-[11px] uppercase tracking-wider">磁盘</TableHead>
              <TableHead className="text-right text-[11px] uppercase tracking-wider">下行</TableHead>
              <TableHead className="text-right text-[11px] uppercase tracking-wider">上行</TableHead>
              <TableHead className="hidden lg:table-cell text-right text-[11px] uppercase tracking-wider">负载</TableHead>
              <TableHead className="hidden xl:table-cell text-right text-[11px] uppercase tracking-wider">读写</TableHead>
              <TableHead className="hidden xl:table-cell text-right text-[11px] uppercase tracking-wider">连接</TableHead>
              <TableHead className="hidden md:table-cell text-right text-[11px] uppercase tracking-wider">运行</TableHead>
              <TableHead className="hidden md:table-cell text-right text-[11px] uppercase tracking-wider">月费</TableHead>
              <TableHead className="text-right text-[11px] uppercase tracking-wider">更新</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {nodes.map(n => {
              const u = deriveUsage(n)
              const logo = distroLogo(n)
              const virt = virtLabel(n)
              const os = osLabel(n)
              const m = n.meta
              const monthly = m && m.price > 0
                ? formatMoney((m.price / (m.priceCycle > 0 ? m.priceCycle : 30)) * 30, normalizeCurrency(m.priceUnit))
                : '—'
              return (
                <TableRow
                  key={n.uuid}
                  data-node-uuid={n.uuid}
                  onClick={() => onOpen?.(n.uuid)}
                  className={cn(
                    'cursor-pointer border-border/30 transition-colors hover:bg-primary/5',
                    !n.online && 'opacity-55',
                  )}
                >
                  <TableCell><StatusPill online={n.online} /></TableCell>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2 min-w-0">
                      {logo && (
                        <img src={logo} alt="" className="w-4 h-4 shrink-0 object-contain" loading="lazy" />
                      )}
                      <span className="truncate">{displayName(n)}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    {m?.region ? <Flag code={m.region} /> : <span className="text-muted-foreground text-sm">—</span>}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <span className="text-xs text-muted-foreground truncate block max-w-[150px]" title={os}>
                      {os || '—'}
                    </span>
                  </TableCell>
                  <TableCell className="hidden xl:table-cell">
                    {virt
                      ? <Badge variant="outline" className="text-[10px] uppercase tracking-wide">{virt}</Badge>
                      : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell><CellBar value={u.cpu} /></TableCell>
                  <TableCell>
                    <CellBar value={u.mem} hint={u.memTotal ? `${bytes(u.memUsed)} / ${bytes(u.memTotal)}` : null} />
                  </TableCell>
                  <TableCell>
                    <CellBar value={u.disk} hint={u.diskTotal ? `${bytes(u.diskUsed)} / ${bytes(u.diskTotal)}` : null} />
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs whitespace-nowrap text-cyan-500">
                    {bytes(u.netIn || 0)}/s
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs whitespace-nowrap text-orange-500">
                    {bytes(u.netOut || 0)}/s
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-right font-mono text-xs whitespace-nowrap"
                    title={n.dynamic?.load_one != null ? `负载 ${n.dynamic.load_one.toFixed(2)} / ${(n.dynamic.load_five ?? 0).toFixed(2)} / ${(n.dynamic.load_fifteen ?? 0).toFixed(2)}` : ''}>
                    {n.dynamic?.load_one != null ? n.dynamic.load_one.toFixed(2) : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="hidden xl:table-cell text-right font-mono text-[11px] whitespace-nowrap text-muted-foreground">
                    {n.dynamic?.read_speed != null || n.dynamic?.write_speed != null
                      ? `${bytes(n.dynamic?.read_speed ?? 0)}/s·${bytes(n.dynamic?.write_speed ?? 0)}/s`
                      : '—'}
                  </TableCell>
                  <TableCell className="hidden xl:table-cell text-right font-mono text-[11px] whitespace-nowrap text-muted-foreground"
                    title="TCP / UDP 连接数">
                    {n.dynamic?.tcp_connections != null || n.dynamic?.udp_connections != null
                      ? `${n.dynamic?.tcp_connections ?? '—'}/${n.dynamic?.udp_connections ?? '—'}`
                      : '—'}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-right font-mono text-xs text-muted-foreground whitespace-nowrap">
                    {uptime(u.uptime)}
                  </TableCell>
                  <TableCell className={cn(
                    'hidden md:table-cell text-right font-mono text-xs whitespace-nowrap',
                    monthly === '—' ? 'text-muted-foreground' : 'text-foreground',
                  )}>
                    {monthly}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs text-muted-foreground whitespace-nowrap">
                    {relativeAge(u.ts)}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </Card>

      {/* 移动端:卡片堆叠 */}
      <div className="md:hidden space-y-2">
        {nodes.map(n => (
          <MobileRow key={n.uuid} node={n} onOpen={onOpen} />
        ))}
      </div>
    </>
  )
}

function MobileRow({ node, onOpen }: { node: Node; onOpen?: (uuid: string) => void }) {
  const u = deriveUsage(node)
  const logo = distroLogo(node)
  const m = node.meta
  const monthly = m && m.price > 0
    ? formatMoney((m.price / (m.priceCycle > 0 ? m.priceCycle : 30)) * 30, normalizeCurrency(m.priceUnit))
    : null

  return (
    <div
      data-node-uuid={node.uuid}
      onClick={() => onOpen?.(node.uuid)}
      className={cn('card-glass rounded-xl p-3 cursor-pointer space-y-2.5', !node.online && 'opacity-55')}
    >
      <div className="flex items-center gap-2">
        <StatusPill online={node.online} />
        {logo && <img src={logo} alt="" className="w-4 h-4 shrink-0 object-contain" loading="lazy" />}
        <span className="font-medium truncate flex-1 text-sm">{displayName(node)}</span>
        {m?.region && <Flag code={m.region} />}
      </div>
      <div className="grid grid-cols-3 gap-2">
        <MiniMetric label="CPU" value={u.cpu} />
        <MiniMetric label="内存" value={u.mem} />
        <MiniMetric label="磁盘" value={u.disk} />
      </div>
      <div className="flex items-center gap-3 text-[11px] font-mono text-muted-foreground">
        <span className="text-cyan-500">↓ {bytes(u.netIn || 0)}/s</span>
        <span className="text-orange-500">↑ {bytes(u.netOut || 0)}/s</span>
        {monthly && <span className="ml-auto text-foreground">{monthly}/月</span>}
      </div>
    </div>
  )
}

function MiniMetric({ label, value }: { label: string; value: number | undefined }) {
  return (
    <div className="min-w-0">
      <div className="flex justify-between text-[10px] mb-1">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono">{pct(value)}</span>
      </div>
      <Progress value={value} indicatorClassName={loadColor(value)} className="h-1" />
    </div>
  )
}

function StatusPill({ online }: { online: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium whitespace-nowrap',
        online ? 'bg-emerald-500/10 text-emerald-500' : 'bg-muted text-muted-foreground',
      )}
    >
      <span className="relative flex h-1.5 w-1.5">
        {online && (
          <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
        )}
        <span className={cn('relative inline-flex rounded-full h-1.5 w-1.5', online ? 'bg-emerald-500' : 'bg-muted-foreground/60')} />
      </span>
      {online ? '在线' : '离线'}
    </span>
  )
}

function CellBar({ value, hint }: { value: number | undefined; hint?: string | null }) {
  return (
    <div className="flex items-center gap-2 min-w-[110px]" title={hint || ''}>
      <Progress value={value} indicatorClassName={loadColor(value)} className="flex-1 h-1.5" />
      <span className="font-mono text-xs w-12 text-right">{pct(value)}</span>
    </div>
  )
}
