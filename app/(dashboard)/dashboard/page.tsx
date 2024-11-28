// src/app/(dashboard)/dashboard/page.tsx
import { auth, currentUser } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { hasActiveSubscription, getSubscriptionDetails } from '@/lib/stripe'
import DashboardClient from './dashboard-client'

// We define the page props interface to properly type the searchParams
interface PageProps {
  searchParams: { [key: string]: string | string[] | undefined }
}

export default async function DashboardPage({ searchParams }: PageProps) {
  // First, handle authentication as before
  const { userId } = await auth()
  const user = await currentUser()
  
  if (!userId || !user) {
    redirect('/sign-in')
  }

  // We'll determine if we need to check for a recent checkout
  // Instead of directly accessing searchParams.success, we handle it safely
  const checkForRecentCheckout = await (async () => {
    // This creates a proper async context for reading searchParams
    const params = await Promise.resolve(searchParams)
    return params?.success === 'true'
  })()

  // Now we fetch the subscription data with appropriate options
  const [hasSubscription, subscriptionDetails] = await Promise.all([
    hasActiveSubscription(userId),
    getSubscriptionDetails(userId, {
      retryCount: checkForRecentCheckout ? 5 : 3,
      checkForRecentCheckout
    })
  ])

  // Prepare the initial data for the client component
  const initialData = {
    hasSubscription,
    subscriptionDetails,
    user: {
      firstName: user.firstName
    }
  }

  // Return the client component with the prepared data
  return <DashboardClient initialData={initialData} />
}