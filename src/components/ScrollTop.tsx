import { useEffect, useState } from 'react'
import { ArrowUp } from 'lucide-react'
import { cn } from '../utils/cn'

/** 滚动超过一屏后出现的「回到顶部」悬浮按钮 */
export function ScrollTop() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 600)
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      aria-label="回到顶部"
      title="回到顶部"
      className={cn(
        'fixed bottom-5 left-5 z-40 h-10 w-10 rounded-full card-glass flex items-center justify-center text-primary shadow-lg transition-all duration-300 hover:scale-110 hover:text-primary',
        show ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none',
      )}
    >
      <ArrowUp className="h-4 w-4" />
    </button>
  )
}
