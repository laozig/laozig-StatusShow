import { useState, useEffect } from 'react'
import { Globe, MapPin, Wifi, Shield, Clock, RefreshCw } from 'lucide-react'

export function IpCard() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    fetch('https://ipinfo.io/json')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setData(d); setLoading(false) })
      .catch(() => { setError(true); setLoading(false) })
  }, [])

  if (error) return null

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
          <InfoItem icon={<Wifi className="h-3 w-3 text-cyan-400" />} label="IP" value={data.ip} />
          <InfoItem icon={<MapPin className="h-3 w-3 text-rose-400" />} label="地区" value={`${data.city || ''} ${data.region || ''}`} />
          <InfoItem icon={<Globe className="h-3 w-3 text-violet-400" />} label="组织" value={data.org || data.company || '--'} />
          <InfoItem icon={<Shield className="h-3 w-3 text-emerald-400" />} label="时区" value={data.timezone || '--'} />
        </div>
      )}
    </div>
  )
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
