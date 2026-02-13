'use client'

import { useEffect, useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import { MENTORSHIP_CONFIG } from '@/lib/config'

type LeadMagnetCountdownProps = {
  targetDate: string
  className?: string
}

type TimeParts = {
  days: number
  hours: number
  minutes: number
  seconds: number
}

const pad = (value: number) => value.toString().padStart(2, '0')

const getTimeParts = (target: Date): TimeParts => {
  const now = new Date()
  const diffMs = Math.max(0, target.getTime() - now.getTime())
  const totalSeconds = Math.floor(diffMs / 1000)

  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  return { days, hours, minutes, seconds }
}

export default function LeadMagnetCountdown({
  targetDate,
  className,
}: LeadMagnetCountdownProps) {
  const target = useMemo(() => new Date(targetDate), [targetDate])
  const [timeLeft, setTimeLeft] = useState<TimeParts>(() => getTimeParts(target))
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const id = window.setInterval(() => {
      setTimeLeft(getTimeParts(target))
    }, 1000)

    return () => window.clearInterval(id)
  }, [target])

  if (!mounted) {
    return null
  }

  return (
    <div className={cn('rounded-lg border border-neutral-200 bg-white p-4', className)}>
      <p className="text-pretty text-xs font-medium text-neutral-500">
        Mentorship‑Start: {MENTORSHIP_CONFIG.startDateFormatted}
      </p>
      <div className="mt-2 flex flex-wrap gap-3 text-sm font-semibold text-neutral-900">
        <span>{timeLeft.days} Tage</span>
        <span>{pad(timeLeft.hours)} Std</span>
        <span>{pad(timeLeft.minutes)} Min</span>
        <span>{pad(timeLeft.seconds)} Sek</span>
      </div>
    </div>
  )
}
