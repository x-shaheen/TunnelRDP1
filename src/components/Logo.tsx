import { Monitor } from 'lucide-react'

export function Logo({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center space-x-3 ${className}`}>
      <div className="relative">
        <div className="absolute inset-0 bg-[var(--accent-primary)] rounded-lg blur-sm opacity-20 animate-pulse-slow"></div>
        <div className="relative bg-gradient-to-br from-[var(--accent-primary)] to-[var(--accent-hover)] p-2 rounded-lg">
          <Monitor className="h-6 w-6 text-black animate-float" />
        </div>
      </div>
      <div className="flex flex-col">
        <div className="flex items-center space-x-1">
          <span className="text-lg font-bold text-[var(--text-primary)] tracking-tight">secret</span>
          <span className="text-lg font-bold text-[var(--accent-primary)] tracking-tight animate-glow">rdp</span>
        </div>
        <div className="text-xs text-[var(--text-muted)] font-mono tracking-wider opacity-80">
          stealth deployment
        </div>
      </div>
    </div>
  )
}

export function LogoMini({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      <div className="relative">
        <div className="absolute inset-0 bg-[var(--accent-primary)] rounded blur-sm opacity-20 animate-pulse-slow"></div>
        <div className="relative bg-gradient-to-br from-[var(--accent-primary)] to-[var(--accent-hover)] p-1.5 rounded">
          <Monitor className="h-4 w-4 text-black" />
        </div>
      </div>
      <span className="text-sm font-bold text-[var(--text-primary)]">
        secret <span className="text-[var(--accent-primary)]">rdp</span>
      </span>
    </div>
  )
}
