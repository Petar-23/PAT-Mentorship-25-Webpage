import 'server-only'

import { getIsAdmin } from '@/lib/authz'
import { prisma } from '@/lib/prisma'
import { RAIDMAP_CONFIG } from '@/lib/raidmap-config'
import { getRaidMapAccessState } from '@/lib/raidmap-access'
import { stripe } from '@/lib/stripe'

export type IndicatorEntitlement = 'mentorship' | 'raidmap'

export type IndicatorEntitlementDecision = {
  allowed: boolean
  entitlement: IndicatorEntitlement
  reason: string
}

export type RevocationGuardDecision = {
  state: 'active' | 'inactive' | 'unknown'
  reason: string
}

export function getIndicatorEntitlement(slug: string): IndicatorEntitlement {
  return slug === RAIDMAP_CONFIG.indicatorSlug ? 'raidmap' : 'mentorship'
}

async function hasStrictMentorshipSubscription(userId: string) {
  const [paypal, cached] = await Promise.all([
    prisma.payPalSubscriber.findUnique({ where: { userId }, select: { status: true } }),
    prisma.userSubscription.findUnique({
      where: { userId },
      select: {
        stripeSubscriptionId: true,
        status: true,
        cancelAtPeriodEnd: true,
        cancelAt: true,
        currentPeriodEnd: true,
        priceIds: true,
      },
    }),
  ])
  if (paypal?.status === 'ACTIVE') return true
  if (!cached?.stripeSubscriptionId) return false
  if (cached.status !== 'active' && cached.status !== 'trialing') return false
  if (!cached.currentPeriodEnd || cached.currentPeriodEnd.getTime() <= Date.now()) return false
  if (cached.status === 'trialing' && (cached.cancelAtPeriodEnd || cached.cancelAt != null)) {
    return false
  }

  const requiredPrices = mentorshipAccessPriceIds()
  if (requiredPrices.size === 0 || !Array.isArray(cached.priceIds)) return false
  return cached.priceIds.some(
    (value) => typeof value === 'string' && requiredPrices.has(value)
  )
}

/**
 * Authoritative server-side product gate for creating and executing claims.
 * UI visibility and an Indicator ID alone never establish entitlement.
 */
export async function evaluateIndicatorEntitlement(input: {
  userId: string
  indicatorSlug: string
  sessionClaims?: unknown
}): Promise<IndicatorEntitlementDecision> {
  const entitlement = getIndicatorEntitlement(input.indicatorSlug)

  if (entitlement === 'raidmap') {
    const access = await getRaidMapAccessState(input.userId)
    return {
      allowed: access.hasAccess,
      entitlement,
      reason: access.hasAccess ? 'raidmap_subscription_active' : 'raidmap_subscription_missing',
    }
  }

  if (await hasStrictMentorshipSubscription(input.userId)) {
    return { allowed: true, entitlement, reason: 'mentorship_subscription_active' }
  }

  try {
    if (await getIsAdmin(input.userId, input.sessionClaims)) {
      return { allowed: true, entitlement, reason: 'admin' }
    }
  } catch (error) {
    console.error('[indicator-entitlements] Admin entitlement check failed:', error)
  }

  return { allowed: false, entitlement, reason: 'mentorship_subscription_missing' }
}

function liveStripeSubscriptionIsActive(subscription: {
  status: string
  current_period_end?: number | null
  cancel_at_period_end?: boolean
  cancel_at?: number | null
}) {
  const periodStillActive =
    typeof subscription.current_period_end === 'number' &&
    subscription.current_period_end * 1000 > Date.now()
  if (!periodStillActive) return false
  if (subscription.status === 'active') return true
  if (subscription.status !== 'trialing') return false
  return !subscription.cancel_at_period_end && subscription.cancel_at == null
}

function mentorshipAccessPriceIds() {
  const configured = process.env.STRIPE_ACCESS_PRICE_IDS
    ?.split(',')
    .map((value) => value.trim())
    .filter(Boolean)
  if (configured && configured.length > 0) return new Set(configured)
  const legacy = process.env.STRIPE_PRICE_ID?.trim()
  return legacy ? new Set([legacy]) : new Set<string>()
}

function hasMentorshipPrice(subscription: {
  items?: { data?: Array<{ price?: { id?: string | null } | string | null }> }
}) {
  const required = mentorshipAccessPriceIds()
  if (required.size === 0) return null
  return (subscription.items?.data ?? []).some((item) => {
    const priceId = typeof item.price === 'string' ? item.price : item.price?.id
    return typeof priceId === 'string' && required.has(priceId)
  })
}

/**
 * Fail-safe guard used immediately before destructive mentorship revocation.
 * It checks both providers independently. Provider/API uncertainty means retry,
 * never "guess inactive" and revoke an alternatively entitled customer.
 */
export async function evaluateMentorshipRevocationGuard(
  userId: string
): Promise<RevocationGuardDecision> {
  const [paypal, subscription] = await Promise.all([
    prisma.payPalSubscriber.findUnique({ where: { userId }, select: { status: true } }),
    prisma.userSubscription.findUnique({
      where: { userId },
      select: { stripeSubscriptionId: true, stripeCustomerId: true },
    }),
  ])

  if (paypal?.status === 'ACTIVE') {
    return { state: 'active', reason: 'paypal_active' }
  }

  let adminCheckFailed = false
  try {
    if (await getIsAdmin(userId)) {
      return { state: 'active', reason: 'admin' }
    }
  } catch (error) {
    const status =
      error && typeof error === 'object' && 'status' in error
        ? Number((error as { status?: unknown }).status)
        : null
    adminCheckFailed = status !== 404
    if (adminCheckFailed) {
      console.error('[entitlement-revocation] Admin guard unavailable:', error)
    }
  }

  if (subscription?.stripeCustomerId) {
    try {
      const liveSubscriptions = await stripe.subscriptions.list({
        customer: subscription.stripeCustomerId,
        status: 'all',
        limit: 100,
      })
      if (liveSubscriptions.has_more) {
        return { state: 'unknown', reason: 'stripe_subscription_mapping_ambiguous' }
      }
      if (
        subscription.stripeSubscriptionId &&
        !liveSubscriptions.data.some(
          (candidate) => candidate.id === subscription.stripeSubscriptionId
        )
      ) {
        return { state: 'unknown', reason: 'stripe_subscription_mapping_mismatch' }
      }

      const activeSubscriptions = liveSubscriptions.data.filter(liveStripeSubscriptionIsActive)
      const matchingActive = activeSubscriptions.filter(
        (candidate) => hasMentorshipPrice(candidate) === true
      )
      if (matchingActive.length > 0) {
        return { state: 'active', reason: 'stripe_active' }
      }
      if (
        activeSubscriptions.length > 0 &&
        activeSubscriptions.some((candidate) => hasMentorshipPrice(candidate) === null)
      ) {
        return { state: 'unknown', reason: 'stripe_access_price_not_configured' }
      }
    } catch (error) {
      console.error('[entitlement-revocation] Stripe guard unavailable:', error)
      return { state: 'unknown', reason: 'stripe_guard_unavailable' }
    }
  } else if (subscription?.stripeSubscriptionId) {
    try {
      const liveSubscription = await stripe.subscriptions.retrieve(
        subscription.stripeSubscriptionId
      )
      const priceMatch = hasMentorshipPrice(liveSubscription)
      if (liveStripeSubscriptionIsActive(liveSubscription) && priceMatch === true) {
        return { state: 'active', reason: 'stripe_active' }
      }
      if (liveStripeSubscriptionIsActive(liveSubscription) && priceMatch === null) {
        return { state: 'unknown', reason: 'stripe_access_price_not_configured' }
      }
    } catch (error) {
      console.error('[entitlement-revocation] Stripe guard unavailable:', error)
      return { state: 'unknown', reason: 'stripe_guard_unavailable' }
    }
  }

  if (adminCheckFailed) {
    return { state: 'unknown', reason: 'admin_guard_unavailable' }
  }

  return { state: 'inactive', reason: 'no_active_mentorship_provider' }
}
