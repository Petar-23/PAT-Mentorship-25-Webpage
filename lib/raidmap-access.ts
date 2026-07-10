import 'server-only'

import { prisma, withPrismaRetry } from '@/lib/prisma'
import { getRaidMapPriceId } from '@/lib/stripe'
import { RAIDMAP_CONFIG } from '@/lib/raidmap-config'
import { getRaidMapTestAccess, isRaidMapTestMode, RAIDMAP_TEST_USER_ID } from '@/lib/raidmap-test-mode'

// Zugangs-Status für die PAT Raid Map: rein über den UserSubscription-Cache
// (der Stripe-Webhook hält ihn aktuell). Aktiv oder im Trial = Zugang.

export type RaidMapAccessState = {
  hasAccess: boolean
  status: string | null
  tier: 'monthly' | 'annual' | null
}

const RAIDMAP_PAST_DUE_GRACE_MS = 72 * 60 * 60 * 1000

function hasTimeBoundSubscriptionAccess(subscription: {
  status: string
  currentPeriodEnd: Date | null
  pastDueSince: Date | null
  updatedAt: Date
}) {
  const now = Date.now()
  const periodEnd = subscription.currentPeriodEnd?.getTime() ?? 0

  // Missing/stale period data must never create indefinite product access.
  if (periodEnd <= now) return false

  if (subscription.status === 'active' || subscription.status === 'trialing') {
    return true
  }

  // A failed renewal gets a short operational grace period, not access for a
  // complete new billing cycle simply because Stripe reports a future end.
  if (subscription.status === 'past_due') {
    const pastDueSince = subscription.pastDueSince ?? subscription.updatedAt
    return pastDueSince.getTime() + RAIDMAP_PAST_DUE_GRACE_MS > now
  }

  return false
}

export async function getRaidMapAccessState(userId: string): Promise<RaidMapAccessState> {
  // Dev-only Test-Mode: simulierter Abo-Zustand für den Test-User, keine DB-Abfrage
  // (doppelt geguarded in lib/raidmap-test-mode.ts, in Production immer aus).
  if (isRaidMapTestMode() && userId === RAIDMAP_TEST_USER_ID) {
    return getRaidMapTestAccess()
  }

  const subscription = await withPrismaRetry(
    () => prisma.raidMapSubscription.findUnique({ where: { userId } }),
    { label: 'Load raidmap subscription' }
  )

  if (!subscription) {
    return { hasAccess: false, status: null, tier: null }
  }

  const monthlyId = getRaidMapPriceId('monthly')
  const annualId = getRaidMapPriceId('annual')

  const tier: RaidMapAccessState['tier'] =
    subscription.tier === 'annual' || subscription.tier === 'monthly'
      ? subscription.tier
      : subscription.priceId && subscription.priceId === annualId
        ? 'annual'
        : subscription.priceId && subscription.priceId === monthlyId
          ? 'monthly'
          : null

  const hasAccess = tier !== null && hasTimeBoundSubscriptionAccess(subscription)

  return { hasAccess, status: subscription.status, tier }
}

export async function getRaidMapIndicator() {
  return withPrismaRetry(
    () =>
      prisma.indicator.findUnique({
        where: { slug: RAIDMAP_CONFIG.indicatorSlug },
        select: { id: true, name: true, pineId: true, ready: true, visible: true },
      }),
    { label: 'Load raidmap indicator' }
  )
}
