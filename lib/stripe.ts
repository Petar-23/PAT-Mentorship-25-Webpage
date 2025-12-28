// src/lib/stripe.ts
import Stripe from 'stripe'
import { prisma } from './prisma'

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('Missing STRIPE_SECRET_KEY')
}

if (!process.env.NEXT_PUBLIC_APP_URL) {
  throw new Error('Missing NEXT_PUBLIC_APP_URL')
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-10-28.acacia',
  typescript: true,
})

const PROGRAM_START_DATE = new Date('2026-03-01T00:00:00Z')

type SubscriptionDetails = {
  status: string
  startDate: string
  isPending: boolean
  isCanceled: boolean
  cancelAt: string | null
  currentPeriodEnd: string | null
}

type SubscriptionSnapshot = {
  hasActiveSubscription: boolean
  subscriptionDetails: SubscriptionDetails | null
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function normalizePriceIds(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((x): x is string => typeof x === 'string' && x.length > 0)
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

function isActiveStatus(status: string) {
  return status === 'active' || status === 'trialing'
}

function detailsFromValues(values: {
  status: string
  cancelAtPeriodEnd: boolean
  cancelAt: Date | null
  currentPeriodEnd: Date | null
}): SubscriptionDetails {
  return {
    status: values.status,
    startDate: PROGRAM_START_DATE.toISOString(),
    isPending: values.status === 'incomplete',
    isCanceled: values.cancelAtPeriodEnd || values.status === 'canceled',
    cancelAt: values.cancelAt ? values.cancelAt.toISOString() : null,
    currentPeriodEnd: values.currentPeriodEnd ? values.currentPeriodEnd.toISOString() : null,
  }
}

async function readSubscriptionFromDb(userId: string): Promise<{
  status: string
  cancelAtPeriodEnd: boolean
  cancelAt: Date | null
  currentPeriodEnd: Date | null
  priceIds: string[]
} | null> {
  try {
    const row = await prisma.userSubscription.findUnique({
      where: { userId },
      select: {
        status: true,
        cancelAtPeriodEnd: true,
        cancelAt: true,
        currentPeriodEnd: true,
        priceIds: true,
      },
    })

    if (!row) return null

    return {
      status: row.status,
      cancelAtPeriodEnd: Boolean(row.cancelAtPeriodEnd),
      cancelAt: row.cancelAt,
      currentPeriodEnd: row.currentPeriodEnd,
      priceIds: normalizePriceIds(row.priceIds),
    }
  } catch (error) {
    console.error('Error reading subscription from DB:', error)
    return null
  }
}

async function writeSubscriptionToDb(params: {
  userId: string
  stripeCustomerId: string | null
  stripeSubscriptionId: string | null
  status: string
  cancelAtPeriodEnd: boolean
  cancelAt: Date | null
  currentPeriodEnd: Date | null
  priceIds: string[]
}) {
  try {
    await prisma.userSubscription.upsert({
      where: { userId: params.userId },
      create: {
        userId: params.userId,
        stripeCustomerId: params.stripeCustomerId,
        stripeSubscriptionId: params.stripeSubscriptionId,
        status: params.status,
        cancelAtPeriodEnd: params.cancelAtPeriodEnd,
        cancelAt: params.cancelAt,
        currentPeriodEnd: params.currentPeriodEnd,
        priceIds: params.priceIds,
      },
      update: {
        stripeCustomerId: params.stripeCustomerId,
        stripeSubscriptionId: params.stripeSubscriptionId,
        status: params.status,
        cancelAtPeriodEnd: params.cancelAtPeriodEnd,
        cancelAt: params.cancelAt,
        currentPeriodEnd: params.currentPeriodEnd,
        priceIds: params.priceIds,
      },
    })
  } catch (error) {
    // Wichtig: wir wollen die Seite nicht kaputt machen, falls DB-Write scheitert.
    console.error('Error writing subscription to DB:', error)
  }
}

export async function getSubscriptionSnapshot(
  userId: string,
  options: { retryCount?: number; checkForRecentCheckout?: boolean } = {}
): Promise<SubscriptionSnapshot> {
  const requiredPriceId = process.env.STRIPE_PRICE_ID
  const maxRetries = Math.max(1, options.retryCount ?? 1)
  const checkForRecentCheckout = options.checkForRecentCheckout === true

  const db = await readSubscriptionFromDb(userId)
  if (db) {
    // Wenn wir schon sicher wissen, dass es kein Abo gibt, wollen wir NICHT jedes Mal Stripe abfragen.
    // Ausnahme: direkt nach Checkout (success=true) erlauben wir Retries zu Stripe.
    if (db.status === 'none' && !checkForRecentCheckout) {
      return { hasActiveSubscription: false, subscriptionDetails: null }
    }

    if (db.status !== 'none') {
      const isActive = !db.cancelAtPeriodEnd && isActiveStatus(db.status)
      const hasRequiredPrice = requiredPriceId ? db.priceIds.includes(requiredPriceId) : true
      return {
        hasActiveSubscription: isActive && hasRequiredPrice,
        subscriptionDetails: detailsFromValues(db),
      }
    }
  }

  // Fallback: Nur wenn noch kein DB-Record existiert (oder 'none'), einmal Stripe fragen und DB befüllen.
  // Bei "recent checkout" erlauben wir ein paar Retries, weil Stripe manchmal verzögert ist.
  for (let i = 0; i < maxRetries; i++) {
    try {
      const customers = await stripe.customers.search({
        query: `metadata['userId']:'${userId}'`,
      })

      if (!customers.data.length) {
        await writeSubscriptionToDb({
          userId,
          stripeCustomerId: null,
          stripeSubscriptionId: null,
          status: 'none',
          cancelAtPeriodEnd: false,
          cancelAt: null,
          currentPeriodEnd: null,
          priceIds: [],
        })

        if (checkForRecentCheckout && i < maxRetries - 1) {
          await sleep(2000)
          continue
        }

        return { hasActiveSubscription: false, subscriptionDetails: null }
      }

      const stripeCustomerId = customers.data[0].id

      const subscriptions = await stripe.subscriptions.list({
        customer: stripeCustomerId,
        status: 'all',
        limit: 50,
      })

      if (!subscriptions.data.length) {
        await writeSubscriptionToDb({
          userId,
          stripeCustomerId: stripeCustomerId,
          stripeSubscriptionId: null,
          status: 'none',
          cancelAtPeriodEnd: false,
          cancelAt: null,
          currentPeriodEnd: null,
          priceIds: [],
        })

        if (checkForRecentCheckout && i < maxRetries - 1) {
          await sleep(2000)
          continue
        }

        return { hasActiveSubscription: false, subscriptionDetails: null }
      }

      const compute = (subscription: Stripe.Subscription) => {
        const priceIds = getPriceIdsFromSubscription(subscription)
        const isActive =
          !subscription.cancel_at_period_end && isActiveStatus(subscription.status)
        const hasRequiredPrice = requiredPriceId ? priceIds.includes(requiredPriceId) : true
        return { isActive, hasRequiredPrice, priceIds }
      }

      const accessSubscription =
        subscriptions.data.find((sub) => {
          const r = compute(sub)
          return r.isActive && r.hasRequiredPrice
        }) ?? subscriptions.data[0]

      const computed = compute(accessSubscription)

      const cancelAt = accessSubscription.cancel_at
        ? new Date(accessSubscription.cancel_at * 1000)
        : null
      const currentPeriodEnd = accessSubscription.current_period_end
        ? new Date(accessSubscription.current_period_end * 1000)
        : null

      await writeSubscriptionToDb({
        userId,
        stripeCustomerId,
        stripeSubscriptionId: accessSubscription.id,
        status: accessSubscription.status,
        cancelAtPeriodEnd: Boolean(accessSubscription.cancel_at_period_end),
        cancelAt,
        currentPeriodEnd,
        priceIds: computed.priceIds,
      })

      return {
        hasActiveSubscription: computed.isActive && computed.hasRequiredPrice,
        subscriptionDetails: detailsFromValues({
          status: accessSubscription.status,
          cancelAtPeriodEnd: Boolean(accessSubscription.cancel_at_period_end),
          cancelAt,
          currentPeriodEnd,
        }),
      }
    } catch (error) {
      console.error(`Subscription snapshot attempt ${i + 1} failed:`, error)

      if (i < maxRetries - 1 && checkForRecentCheckout) {
        await sleep(2000)
        continue
      }

      // Wenn Stripe gerade nicht erreichbar ist, liefern wir (best-effort) DB-Daten, falls vorhanden.
      if (db && db.status !== 'none') {
        const isActive = !db.cancelAtPeriodEnd && isActiveStatus(db.status)
        const hasRequiredPrice = requiredPriceId ? db.priceIds.includes(requiredPriceId) : true
        return {
          hasActiveSubscription: isActive && hasRequiredPrice,
          subscriptionDetails: detailsFromValues(db),
        }
      }

      return { hasActiveSubscription: false, subscriptionDetails: null }
    }
  }

  return { hasActiveSubscription: false, subscriptionDetails: null }
}

export async function hasActiveSubscription(userId: string): Promise<boolean> {
  const snapshot = await getSubscriptionSnapshot(userId, { retryCount: 1 })
  return snapshot.hasActiveSubscription
}

export async function createCustomerPortalSession(userId: string) {
  try {
    if (!process.env.NEXT_PUBLIC_APP_URL) {
      throw new Error('Missing NEXT_PUBLIC_APP_URL environment variable')
    }

    // Find customer by userId
    const customers = await stripe.customers.search({
      query: `metadata['userId']:'${userId}'`,
    })

    if (!customers.data.length) {
      throw new Error('No customer found')
    }

    // Create Stripe portal session
    const session = await stripe.billingPortal.sessions.create({
      customer: customers.data[0].id,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`,
      locale: 'de',
    })

    if (!session.url) {
      throw new Error('Failed to create portal session')
    }

    return { url: session.url }
  } catch (error) {
    console.error('Error creating portal session:', error)
    throw error
  }
}

export async function createCheckoutSession(userId: string, userEmail: string) {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL

    if (!baseUrl) {
      throw new Error('Missing NEXT_PUBLIC_APP_URL environment variable')
    }

    // Create or get customer
    let customer: Stripe.Customer
    
    const existingCustomers = await stripe.customers.search({
      query: `metadata['userId']:'${userId}'`,
    })

    if (existingCustomers.data.length > 0) {
      customer = existingCustomers.data[0]
    } else {
      customer = await stripe.customers.create({
        email: userEmail,
        metadata: {
          userId: userId,
        },
      })
    }

    // Trial-End-Datum: 01.03.2026 00:00 UTC
    const trialEndDate = new Date('2026-03-01T00:00:00Z')
    const trialEndUnix = Math.floor(trialEndDate.getTime() / 1000)

    const session = await stripe.checkout.sessions.create({
      customer: customer.id,
      payment_method_types: ['card', 'sepa_debit'],
      mode: 'subscription',
      allow_promotion_codes: true,
      billing_address_collection: 'required',
      customer_update: {
        address: 'auto',
        name: 'auto',
      },
      locale: 'de',
      automatic_tax: { enabled: true },
      line_items: [
        {
          price: process.env.STRIPE_PRICE_ID,
          quantity: 1,
        },
      ],
      subscription_data: {
        trial_end: trialEndUnix, // Trial bis genau 01.03.2026 – erste Belastung erst dann
        metadata: {
          userId: userId,
          signupType: "pre_launch_2026"
        }
      },
      success_url: `${baseUrl}/dashboard?success=true`,
      cancel_url: `${baseUrl}/dashboard?canceled=true`,
      metadata: {
        userId: userId,
      },
    })

    return { url: session.url }
  } catch (error) {
    console.error('Error in createCheckoutSession:', error)
    throw error
  }
}

export async function getSubscriptionDetails(
  userId: string, 
  options = { 
    retryCount: 3,
    checkForRecentCheckout: false 
  }
) {
  const snapshot = await getSubscriptionSnapshot(userId, {
    retryCount: options.retryCount,
    checkForRecentCheckout: options.checkForRecentCheckout,
  })

  // Wir behalten das bisherige Verhalten: null wenn keine Subscription-Historie existiert.
  return snapshot.subscriptionDetails
}