import { useState, useEffect } from 'react'
import { Globe, MapPin, Wifi, Shield, Clock, RefreshCw, Eye, EyeOff } from 'lucide-react'

export function IpCard() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [revealed, setRevealed] = useState(false)

  useEffect(() => {
    fetch('https://ipinfo.io/json')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setData(d); setLoading(false) })
      .catch(() => { setError(true); setLoading(false) })
  }, [])

  if (error) return null

  const ip: string = data?.ip || ''
  const maskedIp = ip.replace(/[0-9a-fA-F]/g, '•')

  return (
    <div className="card-glass rounded-xl px-4 py-3 animate-slide-up relative panel-arch">
      <div className="flex items-center gap-2 mb-2">
        <Globe className="h-3.5 w-3.5 text-primary" />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          访客信息
        </span>
        {loading && <RefreshCw className="h-3 w-3 animate-spin text-muted-foreground ml-auto" />}
      </div>

      {!loading && data && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          {/* IP:支持遮掩(默认隐藏,点眼睛查看)*/}
          <div className="flex items-center gap-2">
            <Wifi className="h-3 w-3 text-cyan-400 shrink-0" />
            <div className="min-w-0">
              <div className="text-[10px] text-muted-foreground">IP</div>
              <div className="flex items-center gap-1">
                <span
                  className={cnIp(revealed)}
                  title={revealed ? ip : '已隐藏'}
                >
                  {revealed ? ip : (maskedIp || '••••••')}
                </span>
                <button
                  type="button"
                  onClick={() => setRevealed(v => !v)}
                  aria-label={revealed ? '隐藏 IP' : '显示 IP'}
                  title={revealed ? '隐藏 IP' : '显示 IP'}
                  className="shrink-0 text-muted-foreground/70 hover:text-foreground transition-colors"
                >
                  {revealed ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                </button>
              </div>
            </div>
          </div>
          <InfoItem icon={<MapPin className="h-3 w-3 text-rose-400" />} label="地区" value={`${data.city || ''} ${data.region || ''}`} />
          <InfoItem icon={<Globe className="h-3 w-3 text-violet-400" />} label="组织" value={data.org || data.company || '--'} />
          <InfoItem icon={<Shield className="h-3 w-3 text-emerald-400" />} label="时区" value={data.timezone || '--'} />
        </div>
      )}
    </div>
  )
}

function cnIp(revealed: boolean): string {
  return revealed
    ? 'font-mono font-medium text-foreground/80 truncate'
    : 'font-mono font-medium text-foreground/80 truncate tracking-[0.15em] select-none'
}

function InfoItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      {icon}
      <div>
        <div className="text-[10px] text-muted-foreground">{label}</div>
        <div className="font-mono font-medium text-foreground/80 truncate" title={value}>{value}</div>
      </div>
    </div>
  )
}
