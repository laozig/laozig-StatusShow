// 外观状态中枢。
//
// 统一管理 明暗模式 / 强调色 / 卡片风格 / 预设主题 四个维度,采用模块级 store +
// useSyncExternalStore,使 Navbar 的明暗按钮、主题面板、卡片渲染等多处共享同一状态。
//
// 取值优先级:用户在页内显式选择(localStorage 覆盖) > NodeGet 面板配置默认 > 内置默认。
// 应用方式:
//   - mode  -> <html> 上 .dark / .light class
//   - accent-> <html data-accent="...">  驱动 --primary/--accent/--ring
//   - preset-> <html data-theme="...">   驱动背景/圆角/底色等"整体气质"
// 选预设主题时,会连带把该主题的标志强调色一并应用(用户之后仍可单独改强调色)。

import { useSyncExternalStore } from 'react'

export type ThemeMode = 'light' | 'dark' | 'system'

export interface Appearance {
  mode: ThemeMode
  accent: string
  card: string
  preset: string
  ticker: boolean
}

export interface AccentDef { code: string; name: string; hex: string }
export interface PresetDef { code: string; name: string; accent: string; desc: string; swatch: [string, string] }
export interface CardDef { code: string; name: string; desc: string }

// 17 种强调色(对应 global.css 的 [data-accent="..."])
export const ACCENTS: AccentDef[] = [
  { code: 'cyan', name: '青', hex: '#06b6d4' },
  { code: 'sky', name: '天蓝', hex: '#0ea5e9' },
  { code: 'blue', name: '蓝', hex: '#3b82f6' },
  { code: 'indigo', name: '靛蓝', hex: '#6366f1' },
  { code: 'violet', name: '紫罗兰', hex: '#8b5cf6' },
  { code: 'purple', name: '紫', hex: '#a855f7' },
  { code: 'fuchsia', name: '品红', hex: '#d946ef' },
  { code: 'pink', name: '粉', hex: '#ec4899' },
  { code: 'rose', name: '玫红', hex: '#f43f5e' },
  { code: 'red', name: '红', hex: '#ef4444' },
  { code: 'orange', name: '橙', hex: '#f97316' },
  { code: 'amber', name: '琥珀', hex: '#f59e0b' },
  { code: 'lime', name: '黄绿', hex: '#84cc16' },
  { code: 'green', name: '绿', hex: '#22c55e' },
  { code: 'emerald', name: '翠绿', hex: '#10b981' },
  { code: 'teal', name: '青绿', hex: '#14b8a6' },
  { code: 'slate', name: '石墨', hex: '#64748b' },
]

// 命名预设主题(对应 global.css 的 [data-theme="..."])。
// 每套不仅换色,还换字体 / 圆角 / 调色板 / 质感,风格迥异。
export const PRESETS: PresetDef[] = [
  { code: 'nebula', name: '星云', accent: 'cyan', desc: '青紫玻璃 · 默认', swatch: ['#22d3ee', '#a855f7'] },
  { code: 'modern', name: '简洁现代', accent: 'blue', desc: '留白 · 大圆角 · 无衬线', swatch: ['#3b82f6', '#6366f1'] },
  { code: 'tech', name: '科技', accent: 'cyan', desc: '等宽终端 · 网格底纹', swatch: ['#06b6d4', '#22d3ee'] },
  { code: 'future', name: '未来', accent: 'violet', desc: 'Orbitron · 霓虹辉光', swatch: ['#8b5cf6', '#d946ef'] },
  { code: 'pixel', name: '像素', accent: 'green', desc: '点阵字 · 硬投影 · 扫描线', swatch: ['#84cc16', '#22c55e'] },
  { code: 'realistic', name: '写实', accent: 'slate', desc: '中性实色 · 分层柔影', swatch: ['#64748b', '#475569'] },
  { code: 'antique', name: '古朴', accent: 'teal', desc: '草书 · 青绿山水', swatch: ['#3f9c80', '#1e3a32'] },
  { code: 'medieval', name: '中世纪', accent: 'amber', desc: 'Cinzel 刻铭 · 暗石烫金', swatch: ['#c9a227', '#7a2828'] },
  { code: 'wartorn', name: '战损', accent: 'amber', desc: '打字机 · 做旧裂边', swatch: ['#8a6a32', '#5a4a3a'] },
]

export const CARD_STYLES: CardDef[] = [
  { code: 'glass', name: '玻璃', desc: '玻璃拟态 · 模糊发光' },
  { code: 'classic', name: '经典', desc: '实色卡片 · 清晰边框' },
  { code: 'minimal', name: '极简', desc: '透明描边 · 轻量' },
]

const LS = {
  mode: 'nodeget.theme',
  accent: 'nodeget.accent',
  card: 'nodeget.card',
  preset: 'nodeget.preset',
  ticker: 'nodeget.ticker',
}

const BAKED: Appearance = { mode: 'dark', accent: 'violet', card: 'glass', preset: 'future', ticker: true }

let configDefaults: Partial<Appearance> = {}
let overrides: Partial<Appearance> = readOverrides()

function readOverrides(): Partial<Appearance> {
  if (typeof localStorage === 'undefined') return {}
  const o: Partial<Appearance> = {}
  const m = localStorage.getItem(LS.mode)
  if (m === 'light' || m === 'dark' || m === 'system') o.mode = m
  const a = localStorage.getItem(LS.accent)
  if (a) o.accent = a
  const c = localStorage.getItem(LS.card)
  if (c) o.card = c
  const p = localStorage.getItem(LS.preset)
  if (p) o.preset = p
  const tk = localStorage.getItem(LS.ticker)
  if (tk === 'true' || tk === 'false') o.ticker = tk === 'true'
  return o
}

function compute(): Appearance {
  return {
    mode: overrides.mode ?? configDefaults.mode ?? BAKED.mode,
    accent: overrides.accent ?? configDefaults.accent ?? BAKED.accent,
    card: overrides.card ?? configDefaults.card ?? BAKED.card,
    preset: overrides.preset ?? configDefaults.preset ?? BAKED.preset,
    ticker: overrides.ticker ?? configDefaults.ticker ?? BAKED.ticker,
  }
}

let snapshot = compute()
const listeners = new Set<() => void>()

export function resolveMode(mode: ThemeMode): 'light' | 'dark' {
  if (mode === 'system') {
    return typeof window !== 'undefined' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light'
  }
  return mode
}

function applyDOM(a: Appearance) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  const resolved = resolveMode(a.mode)
  root.classList.toggle('dark', resolved === 'dark')
  root.classList.toggle('light', resolved === 'light')
  root.setAttribute('data-accent', a.accent)
  if (a.preset && a.preset !== 'nebula') root.setAttribute('data-theme', a.preset)
  else root.removeAttribute('data-theme')
}

function update() {
  snapshot = compute()
  applyDOM(snapshot)
  for (const l of listeners) l()
}

function subscribe(cb: () => void) {
  listeners.add(cb)
  return () => { listeners.delete(cb) }
}

// 跟随系统:监听系统明暗变化
if (typeof window !== 'undefined') {
  const mq = window.matchMedia('(prefers-color-scheme: dark)')
  const onChange = () => {
    if ((overrides.mode ?? configDefaults.mode ?? BAKED.mode) === 'system') update()
  }
  mq.addEventListener?.('change', onChange)
}

export function setMode(mode: ThemeMode) {
  overrides.mode = mode
  try { localStorage.setItem(LS.mode, mode) } catch { /* ignore */ }
  update()
}

export function cycleMode() {
  const order: ThemeMode[] = ['dark', 'light', 'system']
  const cur = snapshot.mode
  setMode(order[(order.indexOf(cur) + 1) % order.length])
}

export function setAccent(accent: string) {
  overrides.accent = accent
  try { localStorage.setItem(LS.accent, accent) } catch { /* ignore */ }
  update()
}

export function setCard(card: string) {
  overrides.card = card
  try { localStorage.setItem(LS.card, card) } catch { /* ignore */ }
  update()
}

export function setTicker(on: boolean) {
  overrides.ticker = on
  try { localStorage.setItem(LS.ticker, String(on)) } catch { /* ignore */ }
  update()
}

export function setPreset(code: string) {
  overrides.preset = code
  const p = PRESETS.find(x => x.code === code)
  try {
    localStorage.setItem(LS.preset, code)
    if (p) { overrides.accent = p.accent; localStorage.setItem(LS.accent, p.accent) }
  } catch { /* ignore */ }
  if (p) overrides.accent = p.accent
  update()
}

export function resetAppearance() {
  overrides = {}
  try { for (const k of Object.values(LS)) localStorage.removeItem(k) } catch { /* ignore */ }
  update()
}

/** 由 config.json 的用户偏好注入默认值;不会覆盖用户在页内显式选择的项 */
export function setAppearanceDefaults(d: Partial<Appearance>) {
  let changed = false
  for (const k of ['mode', 'accent', 'card', 'preset'] as const) {
    const v = d[k]
    if (v != null && v !== '' && configDefaults[k] !== v) {
      configDefaults[k] = v as never
      changed = true
    }
  }
  if (changed) update()
}

export function useAppearance(): Appearance {
  return useSyncExternalStore(subscribe, () => snapshot, () => snapshot)
}

// 模块加载即应用一次,尽早消除明暗/主题闪烁
applyDOM(snapshot)
