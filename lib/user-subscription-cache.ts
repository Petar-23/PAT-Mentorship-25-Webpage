import 'server-only'

import type Stripe from 'stripe'
import { prisma } from './prisma'

// Schreibt den Zugangs-Cache UserSubscription aus einem Stripe-Abo. Genutzt vom Stripe-Webhook
// (lib/stripe-webhook-handler.ts) und von der Freischaltung nach dem Gast-Checkout
// (lib/checkout-fulfillment.ts), damit beide Wege dieselbe Regel anwenden.

function unixToDate(unix: number | null | undefined): Date | null {
  if (!unix || !Number.isFinite(unix)) return null
  return new Date(unix * 1000)
}

function getPriceIdsFromSubscription(subscription: Stripe.Subscription): string[] {
  const items = subscription.items?.data ?? []
  const ids = items
    .map((item) => {
      const price = item.price
      const priceId = typeof price === 'string' ? price : price?.id
      return typeof priceId === 'string' && priceId.length > 0 ? priceId : null
    })
    .filter((id): id is string => typeof id === 'string')

  return Array.from(new Set(ids))
}

export async function upsertUserSubscription(params: {
  userId: string
  stripeCustomerId: string
  subscription: Stripe.Subscription
}) {
  const { userId, stripeCustomerId, subscription } = params

  const priceIds = getPriceIdsFromSubscription(subscription)
  const stripeStatus = subscription.status

  // Guard: If Stripe is reporting a non-active status (canceled, past_due, etc.),
  // check if the user has an active PayPal subscription. If so, preserve 'active'
  // status so PayPal access isn't overwritten by a stale Stripe webhook.
  let effectiveStatus = stripeStatus
  if (stripeStatus !== 'active' && stripeStatus !== 'trialing') {
    try {
      const paypalSub = await prisma.payPalSubscriber.findUnique({
        where: { userId },
        select: { status: true },
      })
      if (paypalSub?.status === 'ACTIVE') {
        effectiveStatus = 'active'
        console.log(
          `[stripe-webhook] User ${userId} has active PayPal sub — preserving 'active' status despite Stripe '${stripeStatus}'`
        )
      }
    } catch (err) {
      console.error('[stripe-webhook] PayPal guard check failed:', err)
    }
  }

  await prisma.userSubscription.upsert({
    where: { userId },
    create: {
      userId,
      stripeCustomerId,
      stripeSubscriptionId: subscription.id,
      status: effectiveStatus,
      cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
      currentPeriodEnd: unixToDate(subscription.current_period_end),
      cancelAt: unixToDate(subscription.cancel_at),
      priceIds,
    },
    update: {
      stripeCustomerId,
      stripeSubscriptionId: subscription.id,
      status: effectiveStatus,
      cancelAtPeriodEnd: effectiveStatus === 'active' && stripeStatus !== 'active'
        ? false  // Don't mark as canceling if PayPal keeps it active
        : Boolean(subscription.cancel_at_period_end),
      currentPeriodEnd: unixToDate(subscription.current_period_end),
      cancelAt: effectiveStatus === 'active' && stripeStatus !== 'active'
        ? null
        : unixToDate(subscription.cancel_at),
      priceIds,
    },
  })
}
