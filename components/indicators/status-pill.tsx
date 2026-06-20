import { cn } from '@/lib/utils'
import type { IndicatorClaimStatus } from '@/lib/indicators/types'

const STATUS_LABELS: Record<IndicatorClaimStatus, string> = {
  pending: 'In Queue',
  processing: 'Wird aktiviert',
  granted: 'Aktiv',
  failed: 'Fehler',
  needs_session: 'Session nötig',
  revoked: 'Zurückgesetzt',
}

export function IndicatorStatusPill({
  status,
  className,
}: {
  status: IndicatorClaimStatus
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium',
        status === 'granted' && 'border-emerald-200 bg-emerald-50 text-emerald-800',
        status === 'pending' && 'border-amber-200 bg-amber-50 text-amber-800',
        status === 'processing' && 'border-sky-200 bg-sky-50 text-sky-800',
        status === 'needs_session' && 'border-orange-200 bg-orange-50 text-orange-800',
        status === 'failed' && 'border-red-200 bg-red-50 text-red-800',
        status === 'revoked' && 'border-gray-200 bg-gray-50 text-gray-700',
        className
      )}
    >
      {STATUS_LABELS[status]}
    </span>
  )
}
