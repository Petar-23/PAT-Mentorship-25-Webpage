import 'server-only'

import { currentUser } from '@clerk/nextjs/server'
import { getIsAdmin, isMentorshipAccessible } from '@/lib/authz'
import { getEmailFromSessionClaims } from '@/lib/clerk-claims'
import { hasActiveSubscription } from '@/lib/stripe'

export type MentorshipAccessState = {
  isAdmin: boolean | null
  hasSubscription: boolean
  mentorshipAccessible: boolean
  allowed: boolean
}

export async function getMentorshipAccessState(
  userId: string,
  sessionClaims?: unknown
): Promise<MentorshipAccessState> {
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

  const isAdmin = await getIsAdmin(userId, sessionClaims)
  if (isAdmin) {
    return {
      isAdmin: true,
      hasSubscription: false,
      mentorshipAccessible,
      allowed: true,
    }
  }

  // Nur wenn der schnelle Subscription-Check negativ ist, nutzen wir den teureren Email-Fallback.
  let email = getEmailFromSessionClaims(sessionClaims)
  if (!email) {
    const user = await currentUser()
    email = user?.primaryEmailAddress?.emailAddress ?? null
  }
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
