import type { ComponentType } from 'react'
import { Palette, Sun, Moon, Monitor, RotateCcw, Check, X, Sparkles, CreditCard, Megaphone } from 'lucide-react'
import {
  useAppearance, setMode, setAccent, setCard, setPreset, setTicker, resetAppearance,
  ACCENTS, PRESETS, CARD_STYLES, type ThemeMode,
} from '../hooks/useAppearance'
import { cn } from '../utils/cn'

interface Props {
  open: boolean
  onClose: () => void
}

const MODES: { code: ThemeMode; name: string; icon: ComponentType<{ className?: string }> }[] = [
  { code: 'dark', name: '深色', icon: Moon },
  { code: 'light', name: '浅色', icon: Sun },
  { code: 'system', name: '系统', icon: Monitor },
]

export function ThemePanel({ open, onClose }: Props) {
  const a = useAppearance()
  if (!open) return null

  return (
    <div className="fixed inset-0 z-[60]">
      {/* 遮罩 */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
        aria-hidden
      />

      {/* 右侧抽屉 */}
      <div className="absolute right-0 top-0 h-full w-[min(360px,92vw)] card-glass border-l border-border/60 shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-border/50 shrink-0">
          <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
            <Palette className="h-4 w-4" />
          </div>
          <span className="font-semibold">主题外观</span>
          <button
            onClick={resetAppearance}
            title="恢复默认"
            className="ml-auto p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onClose}
            aria-label="关闭"
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-7">
          {/* 明暗模式 */}
          <Group title="明暗模式" icon={Sun}>
            <div className="grid grid-cols-3 gap-2">
              {MODES.map(m => (
                <SegButton
                  key={m.code}
                  active={a.mode === m.code}
                  onClick={() => setMode(m.code)}
                  icon={m.icon}
                  label={m.name}
                />
              ))}
            </div>
          </Group>

          {/* 预设主题 */}
          <Group title="预设主题" icon={Sparkles}>
            <div className="grid grid-cols-2 gap-2.5">
              {PRESETS.map(p => {
                const active = a.preset === p.code
                return (
                  <button
                    key={p.code}
                    onClick={() => setPreset(p.code)}
                    className={cn(
                      'relative rounded-xl border p-2.5 text-left transition-all hover:-translate-y-0.5',
                      active
                        ? 'border-primary ring-2 ring-primary/30 bg-primary/5'
                        : 'border-border/50 hover:border-primary/40',
                    )}
                  >
                    <div
                      className="h-9 rounded-lg mb-2 shadow-inner"
                      style={{ background: `linear-gradient(135deg, ${p.swatch[0]}, ${p.swatch[1]})` }}
                    />
                    <div className="text-xs font-medium flex items-center gap-1">
                      {p.name}
                      {active && <Check className="h-3 w-3 text-primary" />}
                    </div>
                    <div className="text-[10px] text-muted-foreground truncate">{p.desc}</div>
                  </button>
                )
              })}
            </div>
          </Group>

          {/* 强调色 */}
          <Group title="强调色" icon={Palette}>
            <div className="flex flex-wrap gap-2.5">
              {ACCENTS.map(ac => {
                const active = a.accent === ac.code
                return (
                  <button
                    key={ac.code}
                    onClick={() => setAccent(ac.code)}
                    title={ac.name}
                    aria-label={ac.name}
                    className="w-7 h-7 rounded-full flex items-center justify-center transition-transform hover:scale-110"
                    style={{
                      background: ac.hex,
                      boxShadow: active
                        ? `0 0 0 2px hsl(var(--background)), 0 0 0 4px ${ac.hex}`
                        : undefined,
                    }}
                  >
                    {active && <Check className="h-3.5 w-3.5 text-white drop-shadow" />}
                  </button>
                )
              })}
            </div>
          </Group>

          {/* 卡片风格 */}
          <Group title="卡片风格" icon={CreditCard}>
            <div className="grid grid-cols-3 gap-2">
              {CARD_STYLES.map(c => (
                <SegButton
                  key={c.code}
                  active={a.card === c.code}
                  onClick={() => setCard(c.code)}
                  label={c.name}
                  sub={c.desc}
                />
              ))}
            </div>
          </Group>

          {/* 顶部广播 */}
          <Group title="顶部广播" icon={Megaphone}>
            <div className="grid grid-cols-2 gap-2">
              <SegButton active={a.ticker} onClick={() => setTicker(true)} label="开启" sub="顶部滚动实时概览" />
              <SegButton active={!a.ticker} onClick={() => setTicker(false)} label="关闭" sub="隐藏顶部滚动条" />
            </div>
          </Group>
        </div>

        <div className="px-5 py-3 border-t border-border/50 text-[10px] text-muted-foreground text-center shrink-0">
          设置保存在本地浏览器 · 仅影响当前访客
        </div>
      </div>
    </div>
  )
}

function Group({
  title, icon: Icon, children,
}: {
  title: string; icon: ComponentType<{ className?: string }>; children: React.ReactNode
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
        <Icon className="h-3.5 w-3.5" />
        {title}
      </div>
      {children}
    </div>
  )
}

function SegButton({
  active, onClick, icon: Icon, label, sub,
}: {
  active: boolean
  onClick: () => void
  icon?: ComponentType<{ className?: string }>
  label: string
  sub?: string
}) {
  return (
    <button
      onClick={onClick}
      title={sub}
      className={cn(
        'flex flex-col items-center justify-center gap-1 rounded-lg border py-2.5 px-1 transition-all',
        active
          ? 'border-primary bg-primary/10 text-primary'
          : 'border-border/50 text-muted-foreground hover:border-primary/40 hover:text-foreground',
      )}
    >
      {Icon && <Icon className="h-4 w-4" />}
      <span className="text-[11px] font-medium">{label}</span>
    </button>
  )
}
