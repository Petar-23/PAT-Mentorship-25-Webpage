import AdminDashboardV2 from '@/components/dashboard/AdminDashboardV2'
import { getOwnerMetrics } from '@/lib/owner-metrics'
import type { OwnerMetricsResponse } from '@/lib/owner-metrics'

export default async function OwnerPage() {
  let initialMetrics: OwnerMetricsResponse | null = null
  let initialError: string | null = null

  try {
    initialMetrics = await getOwnerMetrics()
  } catch (error) {
    console.error('Failed to preload owner metrics:', error)
    initialError = error instanceof Error ? error.message : 'Admin-Daten konnten nicht geladen werden'
  }

  return (
    <div className="container mx-auto">
      {/* Full navigation starts support mode without previously loaded analytics/replay scripts. */}
      <div className="flex justify-end px-4 pt-4"><a href="/owner/customer-preview"
        className="inline-flex min-h-11 items-center rounded-lg border px-4 text-sm font-medium">Als Kunde ansehen</a></div>
      <AdminDashboardV2 initialMetrics={initialMetrics} initialError={initialError} />
    </div>
  )
}
