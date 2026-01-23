'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

type CountdownProps = {
  targetDate: string
  className?: string
  variant?: 'light' | 'dark'
}

const pad = (value: number) => value.toString().padStart(2, '0')

const getTimeParts = (target: Date) => {
  const now = new Date()
  const diffMs = Math.max(0, target.getTime() - now.getTime())
  const totalSeconds = Math.floor(diffMs / 1000)

  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  return { days, hours, minutes, seconds }
}

export function Countdown({ targetDate, className, variant = 'light' }: CountdownProps) {
  const target = useMemo(() => new Date(targetDate), [targetDate])
  // Starte mit null, um Hydration-Mismatch zu vermeiden
  const [timeLeft, setTimeLeft] = useState<{ days: number; hours: number; minutes: number; seconds: number } | null>(null)
  const prevRef = useRef<{ days: number; hours: number; minutes: number; seconds: number } | null>(null)
  const [pulse, setPulse] = useState({ days: false, hours: false, minutes: false, seconds: false })

  // Initialisiere timeLeft nur auf dem Client
  useEffect(() => {
    const initial = getTimeParts(target)
    setTimeLeft(initial)
    prevRef.current = initial
  }, [target])

  useEffect(() => {
    const id = window.setInterval(() => {
      const next = getTimeParts(target)
      const prev = prevRef.current

      setTimeLeft(next)

      if (prev) {
        if (next.days !== prev.days) setPulse((curr) => ({ ...curr, days: true }))
        if (next.hours !== prev.hours) setPulse((curr) => ({ ...curr, hours: true }))
        if (next.minutes !== prev.minutes) setPulse((curr) => ({ ...curr, minutes: true }))
        if (next.seconds !== prev.seconds) setPulse((curr) => ({ ...curr, seconds: true }))
      }
      prevRef.current = next
    }, 1000)

    return () => window.clearInterval(id)
  }, [target])

  useEffect(() => {
    const id = window.setTimeout(() => {
      setPulse({ days: false, hours: false, minutes: false, seconds: false })
    }, 250)
    return () => window.clearTimeout(id)
  }, [pulse.days, pulse.hours, pulse.minutes, pulse.seconds])

  const baseBox = variant === 'dark'
    ? 'bg-slate-900/80 border-slate-700 text-slate-100'
    : 'bg-white/80 border-gray-200 text-gray-900'
  const labelText = variant === 'dark' ? 'text-slate-400' : 'text-gray-500'
  const pulseBox = variant === 'dark'
    ? 'bg-amber-900/30 border-amber-500/40 ring-1 ring-amber-500/30'
    : 'bg-amber-50/80 border-amber-200 ring-1 ring-amber-200/70'

   // Zeige Platzhalter während SSR/Hydration
  const display = timeLeft ?? { days: 0, hours: 0, minutes: 0, seconds: 0 }

  return (
    <div className={className}>
      <div className="flex flex-wrap justify-center gap-2 text-center lg:justify-start lg:text-left">
        <div className={`rounded-md border px-4 py-3 min-w-[76px] lg:min-w-[96px] lg:px-4 lg:py-3 transition-colors ${baseBox} ${pulse.days ? `animate-[pulse_0.4s_ease-out_1] ${pulseBox}` : ''}`}>
          <div className="text-xl lg:text-xl font-bold" suppressHydrationWarning>{display.days}</div>
          <div className={`text-xs lg:text-xs uppercase tracking-wide ${labelText}`}>Tage</div>
        </div>
        <div className={`rounded-md border px-4 py-3 min-w-[76px] lg:min-w-[96px] lg:px-4 lg:py-3 transition-colors ${baseBox} ${pulse.hours ? `animate-[pulse_0.4s_ease-out_1] ${pulseBox}` : ''}`}>
          <div className="text-xl lg:text-xl font-bold" suppressHydrationWarning>{pad(display.hours)}</div>
          <div className={`text-xs lg:text-xs uppercase tracking-wide ${labelText}`}>Std</div>
        </div>
        <div className={`rounded-md border px-4 py-3 min-w-[76px] lg:min-w-[96px] lg:px-4 lg:py-3 transition-colors ${baseBox} ${pulse.minutes ? `animate-[pulse_0.4s_ease-out_1] ${pulseBox}` : ''}`}>
          <div className="text-xl lg:text-xl font-bold" suppressHydrationWarning>{pad(display.minutes)}</div>
          <div className={`text-xs lg:text-xs uppercase tracking-wide ${labelText}`}>Min</div>
        </div>
        <div className={`rounded-md border px-4 py-3 min-w-[76px] lg:min-w-[96px] lg:px-4 lg:py-3 transition-colors ${baseBox} ${pulse.seconds ? `animate-[pulse_0.4s_ease-out_1] ${pulseBox}` : ''}`}>
          <div className="text-xl lg:text-xl font-bold" suppressHydrationWarning>{pad(display.seconds)}</div>
          <div className={`text-xs lg:text-xs uppercase tracking-wide ${labelText}`}>Sek</div>
        </div>
      </div>
    </div>
  )
 }
