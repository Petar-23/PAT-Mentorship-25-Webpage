// src/app/dashboard/layout.tsx
import { auth, currentUser } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { hasActiveSubscription, getSubscriptionDetails } from '@/lib/stripe'
import DashboardPage from './page'

export default async function DashboardLayout() {
  const { userId } = await auth()
  const user = await currentUser()
  
  if (!userId || !user) {
    redirect('/sign-in')
  }

  const [hasSubscription, subscriptionDetails] = await Promise.all([
    hasActiveSubscription(userId),
    getSubscriptionDetails(userId)
  ])

  return (
    <DashboardPage 
      initialData={{
        hasSubscription,
        subscriptionDetails,
        user: {
          firstName: user.firstName
        }
      }} 
    />
  )
}