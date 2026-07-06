import type { ReactNode } from 'react'
import { auth, currentUser } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { hasActiveSubscription } from '@/lib/stripe'
import { getIsAdmin } from '@/lib/authz'
import { getEmailFromSessionClaims } from '@/lib/clerk-claims'
import { isMentorshipAccessOverrideEmail } from '@/lib/mentorship-access-overrides'

export default async function CoursesLayout({ children }: { children: ReactNode }) {
  const { userId, sessionClaims } = await auth()

  if (!userId) {
    redirect('/sign-in')
  }

  // Fast path: normale Mitglieder brauchen keinen Clerk-Admin- und currentUser-Lookup.
  if (await hasActiveSubscription(userId)) {
    return <>{children}</>
  }

  // Admin darf immer rein (für Content-Management)
  if (await getIsAdmin(userId, sessionClaims)) {
    return <>{children}</>
  }

  // Email fuer Stripe-Fallback (M25-Migration), nur wenn DB-/PayPal-Fast-Path und Admin negativ waren.
  let email = getEmailFromSessionClaims(sessionClaims)
  if (!email) {
    const user = await currentUser()
    email = user?.primaryEmailAddress?.emailAddress ?? null
  }

  if (isMentorshipAccessOverrideEmail(email)) {
    return <>{children}</>
  }

  const allowed = await hasActiveSubscription(userId, email ?? undefined)

  if (!allowed) {
    redirect('/dashboard?paywall=courses')
  }

  return <>{children}</>
}
