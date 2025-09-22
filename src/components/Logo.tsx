import { TunnelRDPIcon } from './TunnelRDPIcon'

export function Logo({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center space-x-3 ${className}`}>
      <div className="relative">
        <TunnelRDPIcon size={32} />
      </div>
      <div className="flex flex-col">
        <div className="flex items-center space-x-1">
          <span className="text-lg font-bold text-[var(--text-primary)] tracking-tight">Tunnel</span>
          <span className="text-lg font-bold text-[var(--accent-primary)] tracking-tight animate-glow">RDP</span>
        </div>
        <div className="text-xs text-[var(--text-muted)] font-mono tracking-wider opacity-80">
          secure tunneling
        </div>
      </div>
    </div>
  )
}

export function LogoMini({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      <div className="relative">
        <TunnelRDPIcon size={20} />
      </div>
      <span className="text-sm font-bold text-[var(--text-primary)]">
        Tunnel<span className="text-[var(--accent-primary)]">RDP</span>
      </span>
    </div>
  )
}
