import 'server-only'

import { prisma, withPrismaRetry } from '@/lib/prisma'
import { getRaidMapPriceId } from '@/lib/stripe'
import { RAIDMAP_CONFIG } from '@/lib/raidmap-config'

// Zugangs-Status für die PAT Raid Map: rein über den UserSubscription-Cache
// (der Stripe-Webhook hält ihn aktuell). Aktiv oder im Trial = Zugang.

export type RaidMapAccessState = {
  hasAccess: boolean
  status: string | null
  tier: 'monthly' | 'annual' | null
}

const ACTIVE_STATUSES = new Set(['active', 'trialing', 'past_due'])

function asPriceIdList(priceIds: unknown): string[] {
  if (Array.isArray(priceIds)) {
    return priceIds.filter((p): p is string => typeof p === 'string')
  }
  return []
}

export async function getRaidMapAccessState(userId: string): Promise<RaidMapAccessState> {
  const subscription = await withPrismaRetry(
    () => prisma.userSubscription.findUnique({ where: { userId } }),
    { label: 'Load raidmap subscription' }
  )

  if (!subscription) {
    return { hasAccess: false, status: null, tier: null }
  }

  const priceIds = asPriceIdList(subscription.priceIds)
  const monthlyId = getRaidMapPriceId('monthly')
  const annualId = getRaidMapPriceId('annual')

  const tier: RaidMapAccessState['tier'] =
    annualId && priceIds.includes(annualId)
      ? 'annual'
      : monthlyId && priceIds.includes(monthlyId)
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
