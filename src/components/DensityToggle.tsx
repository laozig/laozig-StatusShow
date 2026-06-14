import { Rows3, Rows2, Rows } from 'lucide-react'
import { Button } from './ui/button'
import { cn } from '../utils/cn'

export type Density = 'compact' | 'normal' | 'relaxed'
const KEY = 'nodeget.density'
const CYCLE: Density[] = ['normal', 'compact', 'relaxed']
const LABELS: Record<Density, string> = {
  compact: '紧凑',
  normal: '正常',
  relaxed: '宽松',
}
const ICONS: Record<Density, typeof Rows> = {
  compact: Rows3,
  normal: Rows2,
  relaxed: Rows,
}

export function getDensityClass(d: Density): string {
  if (d === 'compact') return 'density-compact'
  if (d === 'relaxed') return 'density-relaxed'
  return ''
}

export function DensityToggle({ value, onChange }: { value: Density; onChange: (v: Density) => void }) {
  const Icon = ICONS[value]
  return (
    <Button
      variant="outline"
      size="icon"
      onClick={() => {
        const idx = CYCLE.indexOf(value)
        onChange(CYCLE[(idx + 1) % CYCLE.length])
      }}
      aria-label={`密度: ${LABELS[value]}`}
      title={`密度: ${LABELS[value]}`}
    >
      <Icon className="h-4 w-4" />
    </Button>
  )
}

export function initialDensity(): Density {
  return (localStorage.getItem(KEY) as Density) || 'normal'
}

export function saveDensity(d: Density) {
  localStorage.setItem(KEY, d)
}
