// src/app/dashboard/loading.tsx
import { Card, CardContent, CardHeader } from '@/components/ui/card'
//import { AuthButtonsSkeleton } from '@/components/layout/auth-skeleton'

export default function DashboardLoading() {
  return (
    <div className="container mx-auto py-10 px-4">
      <div className="h-10 w-48 bg-gray-200 rounded-md mb-8 animate-pulse" />
      
      <div className="grid md:grid-cols-2 gap-6">
        {[1, 2].map((i) => (
          <Card key={i}>
            <CardHeader>
              <div className="h-6 w-32 bg-gray-200 rounded-md animate-pulse" />
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="h-4 w-full bg-gray-200 rounded-md animate-pulse" />
                <div className="h-4 w-2/3 bg-gray-200 rounded-md animate-pulse" />
                <div className="h-10 w-full bg-gray-200 rounded-md animate-pulse" />
              </div>
            </CardContent>
          </Card>
        ))}

        <Card className="md:col-span-2">
          <CardHeader>
            <div className="h-6 w-32 bg-gray-200 rounded-md animate-pulse" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="h-4 w-full bg-gray-200 rounded-md animate-pulse" />
              <div className="h-2 w-full bg-gray-200 rounded-md animate-pulse" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}