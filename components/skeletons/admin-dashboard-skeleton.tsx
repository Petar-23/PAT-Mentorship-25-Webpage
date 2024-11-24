// src/components/skeletons/admin-dashboard-skeleton.tsx
'use client'

export function DashboardSkeleton() {
  // Stat Card Skeleton Component
  const StatCardSkeleton = () => (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="flex items-center gap-2">
        <div className="w-5 h-5 bg-gray-200 rounded animate-pulse" />
        <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
      </div>
      <div className="space-y-2">
        <div className="h-7 w-20 bg-gray-200 rounded animate-pulse" />
        <div className="h-3 w-16 bg-gray-200 rounded animate-pulse" />
      </div>
    </div>
  )

  // Customer Section Skeleton
  const CustomerSectionSkeleton = () => (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="h-6 w-32 bg-gray-200 rounded animate-pulse" />
        <div className="h-5 w-5 bg-gray-200 rounded animate-pulse" />
      </div>
      {/* Customer rows */}
      {[1, 2].map((i) => (
        <div key={i} className="p-3 rounded-lg bg-gray-50">
          <div className="space-y-2">
            <div className="h-4 w-3/4 bg-gray-200 rounded animate-pulse" />
            <div className="flex flex-wrap gap-2">
              <div className="h-3 w-24 bg-gray-200 rounded animate-pulse" />
              <div className="h-3 w-16 bg-gray-200 rounded animate-pulse" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )

  return (
    <div className="container mx-auto py-6 px-4">
      <div className="grid gap-4">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {[1, 2, 3, 4].map((i) => (
            <StatCardSkeleton key={i} />
          ))}
        </div>

        {/* Customer Overview Card */}
        <div className="rounded-lg border">
          {/* Header */}
          <div className="p-6 border-b space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-2">
                <div className="h-6 w-40 bg-gray-200 rounded animate-pulse" />
                <div className="h-4 w-56 bg-gray-200 rounded animate-pulse" />
              </div>
              <div className="w-full sm:w-32 h-9 bg-gray-200 rounded animate-pulse" />
            </div>
          </div>

          {/* Content */}
          <div className="p-6">
            <div className="space-y-8">
              {/* Three sections for each customer type */}
              {[1, 2, 3].map((i) => (
                <CustomerSectionSkeleton key={i} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}