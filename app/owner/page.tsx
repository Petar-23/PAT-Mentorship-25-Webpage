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
      <AdminDashboardV2 initialMetrics={initialMetrics} initialError={initialError} />
    </div>
  )
}
