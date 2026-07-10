import 'server-only'

import { currentUser } from '@clerk/nextjs/server'
import { getIsAdmin, isMentorshipAccessible } from '@/lib/authz'
import { getVerifiedPrimaryEmail } from '@/lib/clerk-email'
import { isMentorshipAccessOverrideEmail } from '@/lib/mentorship-access-overrides'
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
  const user = await currentUser()
  const verifiedEmail = getVerifiedPrimaryEmail(user)

  if (isMentorshipAccessOverrideEmail(verifiedEmail)) {
    return {
      isAdmin: false,
      hasSubscription: true,
      mentorshipAccessible,
      allowed: mentorshipAccessible,
    }
  }

  const hasSubscriptionWithFallback = verifiedEmail
    ? await hasActiveSubscription(userId, verifiedEmail)
    : false

  return {
    isAdmin: false,
    hasSubscription: hasSubscriptionWithFallback,
    mentorshipAccessible,
    allowed: hasSubscriptionWithFallback && mentorshipAccessible,
  }
}
