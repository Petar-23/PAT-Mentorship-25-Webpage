// src/components/skeletons/dashboard-skeleton.tsx
import { Card, CardHeader, CardContent } from '@/components/ui/card'

const StatCardSkeleton = () => (
  <Card>
    <CardHeader>
      <div className="h-6 w-32 bg-gray-200 rounded-md animate-pulse" />
    </CardHeader>
    <CardContent>
      <div className="space-y-2">
        <div className="h-8 w-24 bg-gray-200 rounded-md animate-pulse" />
        <div className="h-4 w-32 bg-gray-200 rounded-md animate-pulse" />
      </div>
    </CardContent>
  </Card>
)

const CustomerListSkeleton = () => (
  <div className="space-y-4">
    <div className="h-6 w-48 bg-gray-200 rounded-md animate-pulse" />
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="p-4 bg-gray-50 rounded-lg">
          <div className="space-y-3">
            <div className="h-5 w-48 bg-gray-200 rounded-md animate-pulse" />
            <div className="flex gap-2">
              <div className="h-4 w-32 bg-gray-200 rounded-md animate-pulse" />
              <div className="h-4 w-20 bg-gray-200 rounded-md animate-pulse" />
            </div>
          </div>
        </div>
      ))}
    </div>
  </div>
)

export function DashboardSkeleton() {
  return (
    <div className="container mx-auto py-10">
      <div className="grid gap-6">
        {/* Stats Grid */}
        <div className="grid md:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <StatCardSkeleton key={i} />
          ))}
        </div>

        {/* Customer Lists */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <div className="h-6 w-48 bg-gray-200 rounded-md animate-pulse" />
                <div className="h-4 w-64 bg-gray-200 rounded-md animate-pulse" />
              </div>
              <div className="h-9 w-32 bg-gray-200 rounded-md animate-pulse" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-8">
              {[1, 2, 3].map((i) => (
                <CustomerListSkeleton key={i} />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}