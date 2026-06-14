import { useEffect, useMemo, useRef, useState } from 'react'
import * as echarts from 'echarts'
import { AlertTriangle, ChevronRight, X } from 'lucide-react'
import { Card } from './ui/card'
import { Flag } from './Flag'
import { StatusDot } from './StatusDot'
import { displayName, distroLogo } from '../utils/derive'
import { useAppearance } from '../hooks/useAppearance'
import type { Node } from '../types'

const MAP_W = 900
const MAP_H = 520
const GEO_URL = `${import.meta.env.BASE_URL}world.geo.json`

interface Accent { h: number; s: number }

/** 读取当前强调色 HSL(由 data-accent 注入的 --primary) */
function readAccent(): Accent {
  if (typeof document === 'undefined') return { h: 189, s: 90 }
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim()
  const parts = raw.split(/\s+/)
  const h = parseFloat(parts[0])
  const s = parseFloat(parts[1])
  return { h: Number.isFinite(h) ? h : 189, s: Number.isFinite(s) ? s : 90 }
}

const cnameMap = new Map<string, string>()
const knownA2 = new Set<string>()
const countryCenter = new Map<string, [number, number]>()
let mapPromise: Promise<void> | null = null

interface CountryEntry {
  online: number
  offline: number
  nodes: Node[]
}

interface Props {
  nodes: Node[]
  onOpen?: (uuid: string) => void
}

function ringBbox(ring: number[][]) {
  let minLng = Infinity
  let maxLng = -Infinity
  let minLat = Infinity
  let maxLat = -Infinity
  for (const [lng, lat] of ring) {
    if (lng < minLng) minLng = lng
    if (lng > maxLng) maxLng = lng
    if (lat < minLat) minLat = lat
    if (lat > maxLat) maxLat = lat
  }
  return { minLng, maxLng, minLat, maxLat, w: maxLng - minLng, h: maxLat - minLat }
}

function tinyMeta(geometry: any): { center: [number, number]; size: number } | null {
  if (!geometry?.coordinates) return null
  const polygons = geometry.type === 'MultiPolygon' ? geometry.coordinates : [geometry.coordinates]
  let best: ReturnType<typeof ringBbox> | null = null
  let bestArea = -1
  for (const poly of polygons) {
    const outer = poly[0]
    if (!outer) continue
    const bb = ringBbox(outer)
    const area = bb.w * bb.h
    if (area > bestArea) {
      bestArea = area
      best = bb
    }
  }
  if (!best) return null
  return {
    center: [(best.minLng + best.maxLng) / 2, (best.minLat + best.maxLat) / 2],
    size: Math.max(best.w, best.h),
  }
}

function ensureMap() {
  if (!mapPromise) {
    mapPromise = fetch(GEO_URL)
      .then(r => r.json())
      .then(geo => {
        for (const f of geo.features ?? []) {
          const a2 = f.properties?.name
          if (!a2) continue
          knownA2.add(a2)
          if (f.properties?.cname) cnameMap.set(a2, f.properties.cname)
          const m = tinyMeta(f.geometry)
          if (m) countryCenter.set(a2, m.center)
        }
        echarts.registerMap('world', geo)
      })
      .catch(err => {
        mapPromise = null
        throw err
      })
  }
  return mapPromise
}

export function WorldMap({ nodes, onOpen }: Props) {
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [pickedA2, setPickedA2] = useState<string | null>(null)
  const [renderA2, setRenderA2] = useState<string | null>(null)
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const chartRef = useRef<echarts.ECharts | null>(null)
  const { accent: accentCode, preset, mode } = useAppearance()
  const accent = useMemo<Accent>(() => readAccent(), [accentCode, preset, mode])

  useEffect(() => {
    let cancelled = false
    ensureMap()
      .then(() => {
        if (!cancelled) setReady(true)
      })
      .catch(err => {
        if (!cancelled) setError(err instanceof Error ? err : new Error(String(err)))
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (pickedA2) {
      setRenderA2(pickedA2)
    } else if (renderA2) {
      const t = window.setTimeout(() => setRenderA2(null), 160)
      return () => clearTimeout(t)
    }
  }, [pickedA2, renderA2])

  const { byCountry, total } = useMemo(() => {
    const map = new Map<string, CountryEntry>()
    let total = 0
    for (const n of nodes) {
      const a2 = n.meta?.region?.trim().toUpperCase()
      if (!a2 || !/^[A-Z]{2}$/.test(a2)) continue
      total++
      const e = map.get(a2) || { online: 0, offline: 0, nodes: [] }
      if (n.online) e.online++
      else e.offline++
      e.nodes.push(n)
      map.set(a2, e)
    }
    return { byCountry: map, total }
  }, [nodes])

  const summary = useMemo(() => {
    let online = 0, offline = 0
    for (const e of byCountry.values()) { online += e.online; offline += e.offline }
    return { online, offline, countries: byCountry.size }
  }, [byCountry])

  const dataSig = useMemo(
    () =>
      [...byCountry.entries()]
        .map(([k, v]) => `${k}:${v.online}/${v.offline}`)
        .sort()
        .join(','),
    [byCountry],
  )

  const liveRef = useRef({ byCountry, onOpen })
  useEffect(() => {
    liveRef.current = { byCountry, onOpen }
  })

  const option = useMemo(() => buildOption(byCountry, accent), [dataSig, ready, accent.h, accent.s])

  useEffect(() => {
    if (!ready || !wrapRef.current) return
    if (!chartRef.current) {
      chartRef.current = echarts.init(wrapRef.current)
      chartRef.current.on('click', (p: any) => {
        const cur = liveRef.current
        const a2 = p?.data?.a2 || p?.name
        const e = a2 ? cur.byCountry.get(a2) : null
        if (!e) return
        if (e.nodes.length === 1) cur.onOpen?.(e.nodes[0].uuid)
        else setPickedA2(a2)
      })
    }
    chartRef.current.setOption(option, true)
  }, [ready, option])

  useEffect(() => {
    if (!ready || !chartRef.current) return
    const ro = new ResizeObserver(() => chartRef.current?.resize())
    if (wrapRef.current) ro.observe(wrapRef.current)
    return () => ro.disconnect()
  }, [ready])

  useEffect(() => {
    return () => {
      chartRef.current?.dispose()
      chartRef.current = null
    }
  }, [])

  const renderEntry = renderA2 ? byCountry.get(renderA2) ?? null : null

  return (
    <Card className="p-3 sm:p-4">
      <div className="flex items-center gap-3 mb-3 px-1 flex-wrap">
        <div className="text-sm font-semibold">地理分布</div>
        <div className="flex items-center gap-3 text-xs font-mono ml-auto">
          <span className="text-muted-foreground">{summary.countries} 地区</span>
          <span className="inline-flex items-center gap-1 text-emerald-500">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />{summary.online} 在线
          </span>
          {summary.offline > 0 && (
            <span className="inline-flex items-center gap-1 text-muted-foreground">
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50" />{summary.offline} 离线
            </span>
          )}
        </div>
      </div>

      <div
        className="relative w-full overflow-hidden rounded-xl border border-border/60"
        style={{
          aspectRatio: `${MAP_W} / ${MAP_H}`,
          background: `radial-gradient(120% 90% at 50% -10%, hsl(${accent.h} ${Math.min(accent.s, 60)}% 12%), hsl(${accent.h} 18% 5%))`,
        }}
      >
        <div ref={wrapRef} className="absolute inset-0" />

        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-4 text-center text-sm text-white/80">
            <AlertTriangle className="h-5 w-5 text-amber-400" />
            <div>地图加载失败</div>
            <div className="text-xs text-white/50 break-all">{error.message}</div>
          </div>
        )}

        {!error && ready && total === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-white/55 pointer-events-none">
            没有节点设置过国家代码
          </div>
        )}

        {renderEntry && renderA2 && (
          <NodePopover
            a2={renderA2}
            entry={renderEntry}
            open={pickedA2 === renderA2}
            onPick={uuid => {
              setPickedA2(null)
              onOpen?.(uuid)
            }}
            onClose={() => setPickedA2(null)}
          />
        )}

        <div className="absolute bottom-3 right-4 z-10 font-mono text-sm font-semibold tracking-wider text-white/85 pointer-events-none uppercase">
          {total} nodes
        </div>
      </div>
    </Card>
  )
}

function buildOption(byCountry: Map<string, CountryEntry>, accent: Accent) {
  const entries = [...byCountry.entries()].filter(([a2]) => knownA2.has(a2))

  const accentColor = `hsl(${accent.h} ${accent.s}% 56%)`
  const accentGlow = `hsl(${accent.h} ${accent.s}% 60% / 0.55)`

  // 有节点的国家在底图上轻微高亮,营造层次
  const regions = entries.map(([a2]) => ({
    name: a2,
    itemStyle: { areaColor: `hsl(${accent.h} ${Math.min(accent.s, 70)}% 26%)` },
  }))

  // 每个国家一个脉冲光点(质心),大小随节点数,全在线=强调色,有离线=琥珀
  const points = entries
    .map(([a2, e]) => {
      const c = countryCenter.get(a2)
      if (!c) return null
      const v = e.online + e.offline
      const allOnline = e.offline === 0
      return {
        name: cnameMap.get(a2) || a2,
        a2,
        online: e.online,
        offline: e.offline,
        value: [c[0], c[1], v],
        symbolSize: 7 + Math.min(22, Math.sqrt(v) * 5),
        itemStyle: {
          color: allOnline ? accentColor : '#f59e0b',
          shadowBlur: 12,
          shadowColor: allOnline ? accentGlow : 'rgba(245,158,11,0.5)',
        },
      }
    })
    .filter((x): x is NonNullable<typeof x> => x != null)

  return {
    backgroundColor: 'transparent',
    geo: {
      map: 'world',
      roam: false,
      zoom: 1.2,
      layoutCenter: ['50%', '54%'] as [string, string],
      layoutSize: '128%',
      selectedMode: false,
      silent: false,
      itemStyle: {
        areaColor: 'rgba(148,163,184,0.08)',
        borderColor: `hsl(${accent.h} ${accent.s}% 55% / 0.16)`,
        borderWidth: 0.5,
      },
      emphasis: {
        label: { show: false },
        itemStyle: { areaColor: `hsl(${accent.h} ${accent.s}% 40%)` },
      },
      regions,
    },
    tooltip: {
      trigger: 'item' as const,
      backgroundColor: 'rgba(15,18,30,0.95)',
      borderColor: `hsl(${accent.h} ${accent.s}% 55% / 0.4)`,
      borderWidth: 1,
      padding: [8, 12] as [number, number],
      textStyle: { color: '#e5e7eb', fontSize: 12 },
      formatter: (p: any) => {
        const d = p?.data
        if (!d?.a2) return ''
        const cname = cnameMap.get(d.a2)
        const head = cname ? `${cname} <span style="color:#94a3b8">${d.a2}</span>` : d.a2
        const offline = d.offline
          ? ` <span style="color:#94a3b8">· ${d.offline} 离线</span>`
          : ''
        return `<b>${head}</b><br/>${d.online + d.offline} 节点 <span style="color:#34d399">· ${d.online} 在线</span>${offline}`
      },
    },
    series: [
      {
        type: 'effectScatter' as const,
        coordinateSystem: 'geo' as const,
        geoIndex: 0,
        zlevel: 2,
        symbol: 'circle' as const,
        showEffectOn: 'render' as const,
        rippleEffect: { brushType: 'stroke' as const, scale: 3.2, period: 4 },
        emphasis: { scale: 1.4 },
        data: points,
      },
    ],
  }
}

function NodePopover({
  a2,
  entry,
  open,
  onPick,
  onClose,
}: {
  a2: string
  entry: CountryEntry
  open: boolean
  onPick: (uuid: string) => void
  onClose: () => void
}) {
  const cname = cnameMap.get(a2) || a2
  return (
    <div
      data-state={open ? 'open' : 'closed'}
      className="absolute right-3 top-3 z-20 w-64 rounded-lg border border-border bg-popover text-popover-foreground shadow-xl overflow-hidden origin-top-right duration-150 fill-mode-forwards data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95"
      onClick={e => e.stopPropagation()}
      onMouseDown={e => e.stopPropagation()}
    >
      <div key={a2} className="animate-in fade-in-0 duration-100 fill-mode-forwards">
        <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border/70">
          <Flag code={a2} className="shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold truncate leading-tight">{cname}</div>
            <div className="text-[11px] text-muted-foreground font-mono mt-0.5">
              <span className="text-emerald-500">{entry.online} 在线</span>
              {entry.offline > 0 && <span className="ml-2">{entry.offline} 离线</span>}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="关闭"
            className="-mr-1 h-6 w-6 inline-flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-accent shrink-0"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="max-h-72 overflow-auto py-1">
          {entry.nodes.map(n => {
            const logo = distroLogo(n)
            return (
              <button
                key={n.uuid}
                onClick={() => onPick(n.uuid)}
                className="group w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-accent text-left transition-colors"
              >
                <StatusDot online={n.online} className="w-1.5 h-1.5 ring-1" />
                {logo && (
                  <img
                    src={logo}
                    alt=""
                    className="w-3.5 h-3.5 shrink-0 object-contain opacity-80"
                    loading="lazy"
                  />
                )}
                <span className="truncate flex-1 text-foreground/90">{displayName(n)}</span>
                <ChevronRight className="h-3 w-3 text-muted-foreground/40 shrink-0 transition-transform group-hover:translate-x-0.5 group-hover:text-muted-foreground" />
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
