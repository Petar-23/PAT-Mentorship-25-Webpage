import 'server-only'

import { currentUser } from '@clerk/nextjs/server'
import { getIsAdmin, isMentorshipAccessible } from '@/lib/authz'
import { hasActiveSubscription } from '@/lib/stripe'

export type MentorshipAccessState = {
  isAdmin: boolean | null
  hasSubscription: boolean
  mentorshipAccessible: boolean
  allowed: boolean
}

export async function getMentorshipAccessState(userId: string): Promise<MentorshipAccessState> {
  const mentorshipAccessible = isMentorshipAccessible()

  // Fast path: bestehende DB-/PayPal-Daten sind günstig und reichen für die meisten Mitglieder.
  const hasSubscription = await hasActiveSubscription(userId)
  if (hasSubscription) {
    return {
      isAdmin: null,
      hasSubscription: true,
      mentorshipAccessible,
      allowed: mentorshipAccessible,
    }
  }

  const isAdmin = await getIsAdmin()
  if (isAdmin) {
    return {
      isAdmin: true,
      hasSubscription: false,
      mentorshipAccessible,
      allowed: true,
    }
  }

  // Nur wenn der schnelle Subscription-Check negativ ist, nutzen wir den teureren Email-Fallback.
  const user = await currentUser()
  const email = user?.primaryEmailAddress?.emailAddress
  const hasSubscriptionWithFallback = email
    ? await hasActiveSubscription(userId, email)
    : false

  return {
    isAdmin: false,
    hasSubscription: hasSubscriptionWithFallback,
    mentorshipAccessible,
    allowed: hasSubscriptionWithFallback && mentorshipAccessible,
  }
}
