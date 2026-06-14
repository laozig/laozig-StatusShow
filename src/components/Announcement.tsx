import { Megaphone } from 'lucide-react'

interface Props {
  text: string
}

export function Announcement({ text }: Props) {
  if (!text?.trim()) return null

  return (
    <div className="announcement-bar">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2 flex items-center justify-center gap-2 text-sm">
        <Megaphone className="h-3.5 w-3.5 text-primary shrink-0" />
        <span className="text-foreground/80 truncate">{text}</span>
      </div>
    </div>
  )
}
