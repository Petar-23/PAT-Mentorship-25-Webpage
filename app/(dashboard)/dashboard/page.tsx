// src/app/(dashboard)/dashboard/page.tsx
import { auth, currentUser } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { hasActiveSubscription, getSubscriptionDetails } from '@/lib/stripe'
import DashboardClient from './dashboard-client'

// We need to match Next.js's exact type expectation
interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }> | undefined
}

export default async function DashboardPage({
  searchParams = Promise.resolve({})  // Provide a default value that matches the type
}: PageProps) {
  const { userId } = await auth()
  const user = await currentUser()
  
  if (!userId || !user) {
    redirect('/sign-in')
  }

  // Always treat searchParams as a Promise in production
  const resolvedParams = await searchParams
  const checkForRecentCheckout = resolvedParams?.success === 'true'

  const [hasSubscription, subscriptionDetails] = await Promise.all([
    hasActiveSubscription(userId),
    getSubscriptionDetails(userId, {
      retryCount: checkForRecentCheckout ? 5 : 3,
      checkForRecentCheckout
    })
  ])

  const initialData = {
    hasSubscription,
    subscriptionDetails,
    user: {
      firstName: user.firstName
    }
  }

  return <DashboardClient initialData={initialData} />
}