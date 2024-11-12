// src/app/(dashboard)/dashboard/page.tsx
import { auth, currentUser } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { hasActiveSubscription, getSubscriptionDetails } from '@/lib/stripe'
import DashboardClient from './dashboard-client'

export default async function DashboardPage() {
  const { userId } = await auth()
  const user = await currentUser()
  
  if (!userId || !user) {
    redirect('/sign-in')
  }

  const [hasSubscription, subscriptionDetails] = await Promise.all([
    hasActiveSubscription(userId),
    getSubscriptionDetails(userId)
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