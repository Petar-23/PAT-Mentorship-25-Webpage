// src/app/(dashboard)/dashboard/page.tsx
import { auth, currentUser } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { hasActiveSubscription, getSubscriptionDetails } from '@/lib/stripe'
import DashboardClient from './dashboard-client'


// First, let's define our search parameters type more precisely
type SearchParamsType = { [key: string]: string | string[] | undefined }

// Now, let's create a more specific type for the Promise version
// Instead of using 'any', we'll use the actual type we expect
type PromiseSearchParams = Promise<SearchParamsType>

// Our page props interface now uses a union type instead of an intersection
interface PageProps {
  searchParams: SearchParamsType | PromiseSearchParams
}

export default async function DashboardPage({
  searchParams,
}: PageProps) {
  const { userId } = await auth()
  const user = await currentUser()
  
  if (!userId || !user) {
    redirect('/sign-in')
  }

  // We need to handle the parameter resolution more carefully
  // First, check if it's actually a Promise
  const resolvedParams: SearchParamsType = await (
    searchParams instanceof Promise ? searchParams : Promise.resolve(searchParams)
  )
  
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