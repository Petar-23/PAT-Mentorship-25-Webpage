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
  expired: boolean
}

const pad = (value: number) => value.toString().padStart(2, '0')

const getTimeParts = (target: Date): TimeParts => {
  const now = new Date()
  const targetMs = target.getTime()
  const diffMs = Number.isFinite(targetMs) ? Math.max(0, targetMs - now.getTime()) : 0
  const totalSeconds = Math.floor(diffMs / 1000)

  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  return { days, hours, minutes, seconds, expired: diffMs <= 0 }
}

export default function LeadMagnetCountdown({
  targetDate,
  className,
}: LeadMagnetCountdownProps) {
  const target = useMemo(() => new Date(targetDate), [targetDate])
  const [timeLeft, setTimeLeft] = useState<TimeParts | null>(null)

  useEffect(() => {
    let interval: number | null = null

    const update = () => {
      const next = getTimeParts(target)
      setTimeLeft(next)
      return next.expired
    }

    const stop = () => {
      if (interval) {
        window.clearInterval(interval)
        interval = null
      }
    }

    const start = () => {
      stop()
      const expired = update()

      if (!expired && document.visibilityState === 'visible') {
        interval = window.setInterval(() => {
          if (update()) stop()
        }, 1000)
      }
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        start()
      } else {
        stop()
      }
    }

    start()
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      stop()
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [target])

  if (!timeLeft || timeLeft.expired) {
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
