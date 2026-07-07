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

const ACTIVE_STATUSES = new Set(['active', 'trialing', 'past_due'])

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

  const hasAccess = tier !== null && ACTIVE_STATUSES.has(subscription.status)

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
