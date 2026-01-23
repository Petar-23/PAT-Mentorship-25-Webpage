// src/components/ui/glowing-card.tsx
'use client'

import { GlowingEffect } from './glowing-effect'

interface GlowingCardProps {
  children: React.ReactNode
  className?: string
  glowColor?: string // Custom glow color (hex)
}

export function GlowingCard({ children, className = '', glowColor }: GlowingCardProps) {
  return (
    <div className={`relative h-full rounded-xl border border-slate-700 p-0.5 ${className}`}>
      <GlowingEffect
        spread={40}
        glow={true}
        disabled={false}
        proximity={64}
        inactiveZone={0.01}
        borderWidth={3}
        variant={glowColor ? "custom" : "dark"}
        color={glowColor}
      />
      <div className="relative flex h-full flex-col rounded-lg bg-slate-900">
        {children}
      </div>
    </div>
  )
}