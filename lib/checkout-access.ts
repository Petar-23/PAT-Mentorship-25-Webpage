import 'server-only'

import { currentUser } from '@clerk/nextjs/server'
import { getEmailFromSessionClaims } from '@/lib/clerk-claims'
import { isMentorshipAccessOverrideEmail } from '@/lib/mentorship-access-overrides'
import { getSubscriptionSnapshot } from '@/lib/stripe'
import { decideDashboardView } from '@/lib/checkout-eligibility.mjs'

// Angemeldete Nutzer auf /checkout und /api/checkout/start: Wer schon Zugang hat (Stripe, PayPal,
// Override) oder ein offenes Abo (past_due, unpaid, incomplete), geht ins Dashboard statt zu Stripe.
// Gleiche Regel wie die Dashboard-Weiche (lib/checkout-eligibility.mjs).

export async function resolveSignedInEmail(sessionClaims: unknown): Promise<string | null> {
  const fromClaims = getEmailFromSessionClaims(sessionClaims)
  if (fromClaims) return fromClaims.toLowerCase()
  const user = await currentUser()
  const email =
    user?.primaryEmailAddress?.emailAddress ??
    user?.emailAddresses.find((address) => address.id === user.primaryEmailAddressId)?.emailAddress ??
    null
  return email ? email.toLowerCase() : null
}

export async function hasRunningMembership(userId: string, email: string | null): Promise<boolean> {
  if (isMentorshipAccessOverrideEmail(email)) return true
  const snapshot = await getSubscriptionSnapshot(userId, { retryCount: 1, email: email ?? undefined })
  const decision = decideDashboardView({
    hasActiveSubscription: snapshot.hasActiveSubscription,
    subscriptionDetails: snapshot.subscriptionDetails,
  })
  return decision.view === 'member'
}
