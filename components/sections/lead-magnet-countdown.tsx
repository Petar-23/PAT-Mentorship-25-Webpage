'use client'

import { cn } from '@/lib/utils'
import { MENTORSHIP_CONFIG } from '@/lib/config'

type LeadMagnetCountdownProps = {
  targetDate?: string
  className?: string
}

export default function LeadMagnetCountdown({
  className,
}: LeadMagnetCountdownProps) {
  return (
    <div className={cn('rounded-lg border border-neutral-200 bg-white p-4', className)}>
      <p className="text-pretty text-xs font-medium text-neutral-700">
        {MENTORSHIP_CONFIG.enrollmentLabel}
      </p>
    </div>
  )
}
