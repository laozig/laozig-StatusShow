import { useEffect, useState, createContext, useContext, useCallback, type ReactNode } from 'react'
import { X, Wifi, WifiOff, AlertCircle, Info } from 'lucide-react'
import { cn } from '../utils/cn'

interface Toast {
  id: number
  type: 'success' | 'error' | 'info' | 'warning'
  title: string
  message?: string
}

interface ToastContextType {
  addToast: (t: Omit<Toast, 'id'>) => void
}

const ToastContext = createContext<ToastContextType>({ addToast: () => {} })

export function useToast() {
  return useContext(ToastContext)
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  let nextId = 0

  const addToast = useCallback((t: Omit<Toast, 'id'>) => {
    const id = Date.now() + Math.random()
    setToasts(prev => [...prev.slice(-4), { ...t, id }])
    setTimeout(() => {
      setToasts(prev => prev.filter(x => x.id !== id))
    }, 5000)
  }, [])

  const remove = (id: number) => {
    setToasts(prev => prev.filter(x => x.id !== id))
  }

  const icons = {
    success: <Wifi className="h-4 w-4 text-emerald-400" />,
    error: <WifiOff className="h-4 w-4 text-red-400" />,
    info: <Info className="h-4 w-4 text-blue-400" />,
    warning: <AlertCircle className="h-4 w-4 text-amber-400" />,
  }

  const bgColors = {
    success: 'border-emerald-500/20 bg-emerald-500/5',
    error: 'border-red-500/20 bg-red-500/5',
    info: 'border-blue-500/20 bg-blue-500/5',
    warning: 'border-amber-500/20 bg-amber-500/5',
  }

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-xs">
        {toasts.map(t => (
          <div
            key={t.id}
            className={cn(
              'card-glass rounded-lg px-3 py-2.5 flex items-start gap-2 animate-slide-up border',
              bgColors[t.type],
            )}
          >
            <div className="mt-0.5 shrink-0">{icons[t.type]}</div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium">{t.title}</div>
              {t.message && (
                <div className="text-xs text-muted-foreground mt-0.5 truncate">{t.message}</div>
              )}
            </div>
            <button
              onClick={() => remove(t.id)}
              className="shrink-0 p-0.5 hover:opacity-60 transition-opacity"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
