import type { ReactNode } from 'react'
import { auth, currentUser } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { hasActiveSubscription } from '@/lib/stripe'
import { getIsAdmin } from '@/lib/authz'

export default async function CoursesLayout({ children }: { children: ReactNode }) {
  const { userId } = await auth()

  if (!userId) {
    redirect('/sign-in')
  }

  // Admin darf immer rein (für Content-Management)
  const isAdmin = await getIsAdmin()

  // Email fuer Stripe-Fallback (M25-Migration)
  const user = await currentUser()
  const email = user?.primaryEmailAddress?.emailAddress

  const allowed = isAdmin || (await hasActiveSubscription(userId, email ?? undefined))

  if (!allowed) {
    redirect('/dashboard?paywall=courses')
  }

  return <>{children}</>
}