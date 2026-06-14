import { useEffect, useRef } from 'react'
import { useAppearance, resolveMode } from '../hooks/useAppearance'

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  opacity: number
  hue: number
}

// 从 --primary(格式 "H S% L%")解析色相,使粒子跟随当前强调色
function accentHue(fallback = 189): number {
  if (typeof document === 'undefined') return fallback
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim()
  const h = parseFloat(raw.split(/\s+/)[0])
  return Number.isFinite(h) ? h : fallback
}

export function Particles({ enabled }: { enabled: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)
  const particlesRef = useRef<Particle[]>([])
  const { accent, mode, preset } = useAppearance()

  useEffect(() => {
    if (!enabled) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const base = accentHue()

    const initParticles = (w: number, h: number) => {
      const count = Math.floor((w * h) / 18000)
      const particles: Particle[] = []
      for (let i = 0; i < count; i++) {
        particles.push({
          x: Math.random() * w,
          y: Math.random() * h,
          vx: (Math.random() - 0.5) * 0.3,
          vy: (Math.random() - 0.5) * 0.3,
          size: Math.random() * 2 + 0.5,
          opacity: Math.random() * 0.4 + 0.1,
          hue: base + (Math.random() * 50 - 25), // 围绕强调色色相浮动
        })
      }
      return particles
    }

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
      particlesRef.current = initParticles(canvas.width, canvas.height)
    }
    resize()
    window.addEventListener('resize', resize)

    const isDark = resolveMode(mode) === 'dark'

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      const particles = particlesRef.current

      for (const p of particles) {
        p.x += p.vx
        p.y += p.vy

        if (p.x < 0) p.x = canvas.width
        if (p.x > canvas.width) p.x = 0
        if (p.y < 0) p.y = canvas.height
        if (p.y > canvas.height) p.y = 0

        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        const alpha = isDark ? p.opacity * 0.6 : p.opacity
        ctx.fillStyle = `hsla(${p.hue}, 80%, ${isDark ? '70%' : '50%'}, ${alpha})`
        ctx.fill()
      }

      // Draw connections
      const maxDist = 120
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x
          const dy = particles[i].y - particles[j].y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < maxDist) {
            const alpha = (1 - dist / maxDist) * (isDark ? 0.08 : 0.06)
            ctx.beginPath()
            ctx.moveTo(particles[i].x, particles[i].y)
            ctx.lineTo(particles[j].x, particles[j].y)
            ctx.strokeStyle = `hsla(${base}, 80%, ${isDark ? '60%' : '40%'}, ${alpha})`
            ctx.lineWidth = 0.5
            ctx.stroke()
          }
        }
      }

      animRef.current = requestAnimationFrame(draw)
    }

    draw()

    return () => {
      cancelAnimationFrame(animRef.current)
      window.removeEventListener('resize', resize)
    }
  }, [enabled, accent, mode, preset])

  if (!enabled) return null
  return <canvas ref={canvasRef} className="particles-canvas" />
}
