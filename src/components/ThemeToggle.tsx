import { Moon, Sun, Monitor } from 'lucide-react'
import { Button } from './ui/button'
import { useAppearance, cycleMode, type ThemeMode } from '../hooks/useAppearance'

const LABELS: Record<ThemeMode, string> = {
  light: '浅色模式',
  dark: '深色模式',
  system: '跟随系统',
}

export function ThemeToggle() {
  const { mode } = useAppearance()
  return (
    <Button
      variant="outline"
      size="icon"
      onClick={cycleMode}
      aria-label={LABELS[mode]}
      title={LABELS[mode]}
    >
      {mode === 'dark' && <Moon className="h-4 w-4" />}
      {mode === 'light' && <Sun className="h-4 w-4" />}
      {mode === 'system' && <Monitor className="h-4 w-4" />}
    </Button>
  )
}
