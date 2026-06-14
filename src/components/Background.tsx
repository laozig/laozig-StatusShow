import { useEffect, useRef } from 'react'
import { Particles } from './Particles'
import { useAppearance, resolveMode } from '../hooks/useAppearance'

interface Props {
  showParticles?: boolean
}

// 每套预设主题的光晕色相 + 强度(与 global.css 的 data-theme 背景呼应)
const THEME_HUES: Record<string, number[]> = {
  nebula: [189, 263, 330, 160],
  modern: [217, 239, 199, 217],
  tech: [189, 199, 173, 189],
  future: [263, 292, 199, 280],
  pixel: [110, 142, 160, 100],
  realistic: [215, 220, 210, 218],
  antique: [32, 25, 40, 28],
  medieval: [42, 36, 28, 45],
  wartorn: [38, 30, 25, 42],
}

// 各主题画布光晕强度(0 = 不画,交给 CSS 纹理)
const THEME_ALPHA: Record<string, number> = {
  nebula: 0.06,
  modern: 0.05,
  tech: 0.10,
  future: 0.16,
  pixel: 0,
  realistic: 0,
  antique: 0.05,
  medieval: 0.07,
  wartorn: 0,
}

export function Background({ showParticles = true }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { mode, preset } = useAppearance()

  // Aurora / animated gradient mesh background
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animId: number
    let t = 0

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    const isDark = resolveMode(mode) === 'dark'
    const hues = THEME_HUES[preset] ?? THEME_HUES.nebula
    const baseAlpha = THEME_ALPHA[preset] ?? 0.06

    // 强度为 0 的主题(像素/写实/战损)完全交给 CSS 纹理,不画光晕
    if (baseAlpha <= 0) {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      return () => window.removeEventListener('resize', resize)
    }

    const blobs = [
      { x: 0.2, y: 0.3, r: 320, hue: hues[0], speed: 0.0003 },
      { x: 0.8, y: 0.2, r: 270, hue: hues[1], speed: 0.0004 },
      { x: 0.5, y: 0.8, r: 300, hue: hues[2], speed: 0.0002 },
      { x: 0.1, y: 0.7, r: 220, hue: hues[3], speed: 0.0003 },
    ]

    const draw = () => {
      t++
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      for (const b of blobs) {
        const cx = (b.x + Math.sin(t * b.speed) * 0.15) * canvas.width
        const cy = (b.y + Math.cos(t * b.speed * 0.7) * 0.1) * canvas.height
        const alpha = isDark ? baseAlpha : baseAlpha + 0.02

        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, b.r)
        grad.addColorStop(0, `hsla(${b.hue}, 85%, 60%, ${alpha})`)
        grad.addColorStop(1, 'transparent')
        ctx.fillStyle = grad
        ctx.fillRect(0, 0, canvas.width, canvas.height)
      }

      animId = requestAnimationFrame(draw)
    }

    draw()

    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', resize)
    }
  }, [mode, preset])

  return (
    <>
      {/* Aurora gradient mesh */}
      <canvas
        ref={canvasRef}
        className="fixed inset-0 -z-20 pointer-events-none"
      />
      {/* Base gradient */}
      <div className="fixed inset-0 -z-10 bg-soft" aria-hidden />
      {/* Particles */}
      {showParticles && <Particles enabled={true} />}
    </>
  )
}
