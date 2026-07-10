// src/lib/stripe.ts
import 'server-only'

import Stripe from 'stripe'
import { prisma, withPrismaRetry } from './prisma'
import type { VerifiedEmailAddress } from './clerk-email'
import { selectUniqueEmailFallbackCustomer } from './stripe-customer-policy'

declare global {
  var stripeClient: Stripe | undefined
}

export function getStripe() {
  if (!global.stripeClient) {
    const secretKey = process.env.STRIPE_SECRET_KEY
    if (!secretKey) {
      throw new Error('Missing STRIPE_SECRET_KEY')
    }

    global.stripeClient = new Stripe(secretKey, {
      apiVersion: '2024-10-28.acacia',
      typescript: true,
    })
  }

  return global.stripeClient
}

export const stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    const client = getStripe()
    const value = Reflect.get(client, prop, client) as unknown

    return typeof value === 'function' ? value.bind(client) : value
  },
})

const PROGRAM_START_DATE = new Date('2026-03-01T00:00:00+01:00')

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

function parseCommaSeparatedIds(value: string | undefined): string[] {
  if (!value) return []
  return value
    .split(',')
    .map((x) => x.trim())
    .filter((x) => x.length > 0)
}

function getAccessPriceIdsFromEnv(): string[] {
  // New (recommended): allow multiple mentorship prices (e.g. M25 + M26)
  const access = parseCommaSeparatedIds(process.env.STRIPE_ACCESS_PRICE_IDS)
  if (access.length > 0) return access

  // Backwards compatible fallback: single price id used both for checkout and access.
  const single = process.env.STRIPE_PRICE_ID
  return single ? [single] : []
}

function hasAnyRequiredPrice(priceIds: string[], requiredPriceIds: string[]): boolean {
  if (requiredPriceIds.length === 0) return false
  return priceIds.some((id) => requiredPriceIds.includes(id))
}

function isLiveCustomer(customer: Stripe.Customer | Stripe.DeletedCustomer): customer is Stripe.Customer {
  return !('deleted' in customer && customer.deleted)
}

async function findAndLinkUniqueCustomerByVerifiedEmail(
  userId: string,
  verifiedEmail: VerifiedEmailAddress
): Promise<Stripe.Customer | null> {
  const response = await stripe.customers.list({
    email: verifiedEmail,
    limit: 100,
  })
  const liveCustomers = response.data.filter(isLiveCustomer)
  if (response.has_more) return null

  const selected = selectUniqueEmailFallbackCustomer(liveCustomers, userId)
  if (!selected) return null

  // Refresh immediately before linking so a customer that was bound since the
  // email lookup is rejected instead of overwriting a foreign metadata.userId.
  const refreshed = await stripe.customers.retrieve(selected.customer.id)
  if (!isLiveCustomer(refreshed)) return null

  const refreshedSelection = selectUniqueEmailFallbackCustomer([refreshed], userId)
  if (!refreshedSelection) return null
  if (!refreshedSelection.shouldLinkUserId) return refreshed

  return stripe.customers.update(refreshed.id, {
    metadata: { ...(refreshed.metadata ?? {}), userId },
  })
}

async function validateMappedCustomerForUser(customerId: string, userId: string) {
  const customer = await stripe.customers.retrieve(customerId)
  if (!isLiveCustomer(customer)) return null

  const ownerUserId = customer.metadata?.userId?.trim()
  if (ownerUserId && ownerUserId !== userId) {
    throw new Error('Stripe customer mapping belongs to another user')
  }

  return customer
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
    // Stripe kann Kündigungen als `cancel_at_period_end` ODER als geplantes `cancel_at` abbilden.
    // Für unseren Access zählt beides als "gekündigt".
    isCanceled: values.cancelAtPeriodEnd || values.cancelAt != null || values.status === 'canceled',
    cancelAt: values.cancelAt ? values.cancelAt.toISOString() : null,
    currentPeriodEnd: values.currentPeriodEnd ? values.currentPeriodEnd.toISOString() : null,
  }
}

function isTrialing(status: string) {
  return status === 'trialing'
}

function isInPeriodEnd(date: Date | null) {
  if (!date) return true
  return date.getTime() > Date.now()
}

async function readSubscriptionFromDb(userId: string): Promise<{
  status: string
  cancelAtPeriodEnd: boolean
  cancelAt: Date | null
  currentPeriodEnd: Date | null
  priceIds: string[]
} | null> {
  try {
    const row = await withPrismaRetry(
      () =>
        prisma.userSubscription.findUnique({
          where: { userId },
          select: {
            status: true,
            cancelAtPeriodEnd: true,
            cancelAt: true,
            currentPeriodEnd: true,
            priceIds: true,
          },
        }),
      { label: 'Read subscription from DB' }
    )

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
    await withPrismaRetry(
      () =>
        prisma.userSubscription.upsert({
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
        }),
      { label: 'Write subscription to DB' }
    )
  } catch (error) {
    // Wichtig: wir wollen die Seite nicht kaputt machen, falls DB-Write scheitert.
    console.error('Error writing subscription to DB:', error)
  }
}

// PayPal-Check: Hat der User einen aktiven PayPal-Subscriber-Eintrag?
async function checkPayPalAccess(userId: string): Promise<SubscriptionSnapshot | null> {
  try {
    const paypalSub = await withPrismaRetry(
      () =>
        prisma.payPalSubscriber.findUnique({
          where: { userId },
          select: { status: true },
        }),
      { label: 'Check PayPal access' }
    )

    if (paypalSub?.status === 'ACTIVE') {
      return {
        hasActiveSubscription: true,
        subscriptionDetails: {
          status: 'active',
          startDate: PROGRAM_START_DATE.toISOString(),
          isPending: false,
          isCanceled: false,
          cancelAt: null,
          currentPeriodEnd: null,
        },
      }
    }
  } catch (error) {
    console.error('Error checking PayPal access:', error)
  }
  return null
}

export async function getSubscriptionSnapshot(
  userId: string,
  options: {
    retryCount?: number
    checkForRecentCheckout?: boolean
    verifiedEmail?: VerifiedEmailAddress
  } = {}
): Promise<SubscriptionSnapshot> {
  // Nicht parallel gegen den kleinen Serverless-Pool schießen: direkt nach Deploys kann die erste
  // DB-Verbindung kalt sein, und parallele Acquires treffen dann denselben Connection-Timeout.
  const paypalResult = await checkPayPalAccess(userId)
  if (paypalResult) return paypalResult

  const requiredPriceIds = getAccessPriceIdsFromEnv()
  if (requiredPriceIds.length === 0) {
    console.error('Stripe mentorship access denied: no access price IDs are configured')
    return { hasActiveSubscription: false, subscriptionDetails: null }
  }

  const maxRetries = Math.max(1, options.retryCount ?? 1)
  const checkForRecentCheckout = options.checkForRecentCheckout === true
  const verifiedEmail = options.verifiedEmail

  const db = await readSubscriptionFromDb(userId)
  if (db) {
    // Wenn wir schon sicher wissen, dass es kein Abo gibt, wollen wir NICHT jedes Mal Stripe abfragen.
    // Ausnahme: direkt nach Checkout (success=true) erlauben wir Retries zu Stripe.
    // Ausnahme 2: Email vorhanden → wir koennten den User noch per Email bei Stripe finden (M25-Migration).
    if (db.status === 'none' && !checkForRecentCheckout && !verifiedEmail) {
      return { hasActiveSubscription: false, subscriptionDetails: null }
    }

    if (db.status !== 'none') {
      // Access-Regel:
      // - "active" bleibt bis Ende der Periode aktiv (auch wenn bereits gekündigt wurde)
      // - "trialing" verliert Zugriff sofort nach Kündigung (cancel_at_period_end oder cancel_at)
      const cancelledScheduled = db.cancelAtPeriodEnd || db.cancelAt != null
      const periodStillActive = isInPeriodEnd(db.currentPeriodEnd)
      const isActive =
        periodStillActive &&
        isActiveStatus(db.status) &&
        (!isTrialing(db.status) ? true : !cancelledScheduled)
      const hasRequiredPrice = hasAnyRequiredPrice(db.priceIds, requiredPriceIds)

      const snapshotFromDb = {
        hasActiveSubscription: isActive && hasRequiredPrice,
        subscriptionDetails: detailsFromValues(db),
      }

      // Normalfall: DB-Cache benutzen (schnell).
      // Ausnahme: direkt nach Checkout (success=true) "ziehen wir Stripe nach", falls DB noch eine alte/canceled Subscription hält.
      if (!checkForRecentCheckout || snapshotFromDb.hasActiveSubscription) {
        return snapshotFromDb
      }
    }
  }

  // Wichtig für Stabilität (verhindert 504 Timeouts in z. B. /api/mentorship-status):
  // Wenn noch kein DB-Record existiert und wir NICHT direkt aus dem Checkout zurückkommen
  // UND keine Email zum Nachschlagen vorhanden ist,
  // behandeln wir den User sofort als "kein Abo" und vermeiden langsame Stripe-Lookups.
  if (!db && !checkForRecentCheckout && !verifiedEmail) {
    return { hasActiveSubscription: false, subscriptionDetails: null }
  }

  // Fallback: Nur wenn noch kein DB-Record existiert (oder 'none'), einmal Stripe fragen und DB befüllen.
  // Bei "recent checkout" erlauben wir ein paar Retries, weil Stripe manchmal verzögert ist.
  for (let i = 0; i < maxRetries; i++) {
    try {
      const customers = await stripe.customers.search({
        query: `metadata['userId']:'${userId}'`,
      })
      let customerCandidates = customers.data.filter(isLiveCustomer)

      // Email-Fallback fuer Altkaeufe: nur eine verifizierte Clerk-Primary-Email
      // und genau ein nicht fremd gebundener Stripe-Customer sind zulässig.
      if (!customerCandidates.length && verifiedEmail) {
        const emailCustomer = await findAndLinkUniqueCustomerByVerifiedEmail(
          userId,
          verifiedEmail
        )
        customerCandidates = emailCustomer ? [emailCustomer] : []
      }

      if (!customerCandidates.length) {
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

      const stripeCustomerId = [...customerCandidates].sort(
        (a, b) => b.created - a.created
      )[0].id

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
        const cancelledScheduled =
          Boolean(subscription.cancel_at_period_end) || subscription.cancel_at != null
        const periodStillActive = subscription.current_period_end
          ? subscription.current_period_end * 1000 > Date.now()
          : true

        const isActive =
          periodStillActive &&
          isActiveStatus(subscription.status) &&
          (!isTrialing(subscription.status) ? true : !cancelledScheduled)
        const hasRequiredPrice = hasAnyRequiredPrice(priceIds, requiredPriceIds)
        return { isActive, hasRequiredPrice, priceIds }
      }

      const computedSubscriptions = subscriptions.data.map((sub) => ({ sub, r: compute(sub) }))

      // Prefer subscriptions that match our access price IDs (if configured).
      let candidates = computedSubscriptions
      if (requiredPriceIds.length > 0) {
        const matching = computedSubscriptions.filter((x) => x.r.hasRequiredPrice)
        if (matching.length > 0) candidates = matching
      }

      // Prefer active/trialing subscriptions per business rules.
      const activeCandidates = candidates.filter((x) => x.r.isActive)
      const pool = activeCandidates.length > 0 ? activeCandidates : candidates

      // Tie-breaker: newest subscription wins.
      const picked = [...pool].sort((a, b) => (b.sub.created ?? 0) - (a.sub.created ?? 0))[0]
      const accessSubscription = picked.sub
      const computed = picked.r

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
        const cancelledScheduled = db.cancelAtPeriodEnd || db.cancelAt != null
        const periodStillActive = isInPeriodEnd(db.currentPeriodEnd)
        const isActive =
          periodStillActive &&
          isActiveStatus(db.status) &&
          (!isTrialing(db.status) ? true : !cancelledScheduled)
        const hasRequiredPrice = hasAnyRequiredPrice(db.priceIds, requiredPriceIds)
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

export async function hasActiveSubscription(
  userId: string,
  verifiedEmail?: VerifiedEmailAddress
): Promise<boolean> {
  const snapshot = await getSubscriptionSnapshot(userId, {
    retryCount: 1,
    verifiedEmail,
  })
  return snapshot.hasActiveSubscription
}

export async function createCustomerPortalSession(
  userId: string,
  verifiedEmail?: VerifiedEmailAddress | null
) {
  try {
    if (!process.env.NEXT_PUBLIC_APP_URL) {
      throw new Error('Missing NEXT_PUBLIC_APP_URL environment variable')
    }

    // 1) Prefer DB mapping (fast & robust)
    const db = await prisma.userSubscription.findUnique({
      where: { userId },
      select: { stripeCustomerId: true },
    })

    let stripeCustomerId = db?.stripeCustomerId ?? null
    if (stripeCustomerId) {
      const mappedCustomer = await validateMappedCustomerForUser(stripeCustomerId, userId)
      stripeCustomerId = mappedCustomer?.id ?? null
    }

    // 2) Fallback: search by metadata.userId
    if (!stripeCustomerId) {
      const customers = await stripe.customers.search({
        query: `metadata['userId']:'${userId}'`,
      })

      const liveCustomers = customers.data.filter((c) => !('deleted' in c && c.deleted))
      if (liveCustomers.length > 0) {
        stripeCustomerId = [...liveCustomers].sort((a, b) => b.created - a.created)[0].id
      }
    }

    // 3) Fallback: exakt ein Customer zur verifizierten Clerk-Primary-Email.
    if (!stripeCustomerId && verifiedEmail) {
      const customer = await findAndLinkUniqueCustomerByVerifiedEmail(userId, verifiedEmail)
      stripeCustomerId = customer?.id ?? null
    }

    if (!stripeCustomerId) throw new Error('No customer found')

    // Create Stripe portal session
    const session = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
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

export async function createCheckoutSession(
  userId: string,
  userEmail: VerifiedEmailAddress
) {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL
    const priceId = process.env.STRIPE_PRICE_ID?.trim()
    const accessPriceIds = getAccessPriceIdsFromEnv()

    if (!baseUrl) {
      throw new Error('Missing NEXT_PUBLIC_APP_URL environment variable')
    }
    if (!priceId || !accessPriceIds.includes(priceId)) {
      throw new Error('Missing or inconsistent Stripe mentorship access price configuration')
    }

    // Create or get customer
    let customer: Stripe.Customer
    
    const existingCustomers = await stripe.customers.search({
      query: `metadata['userId']:'${userId}'`,
    })

    if (existingCustomers.data.length > 0) {
      // Falls es (durch Tests) mehrere Customers gibt, nehmen wir den neuesten.
      customer = [...existingCustomers.data].sort((a, b) => b.created - a.created)[0]
    } else {
      customer = await stripe.customers.create({
        email: userEmail,
        metadata: {
          userId: userId,
        },
      })
    }

    // Safety (wichtig für ordnungsgemäße Rechnungen):
    // Wir setzen die Customer-Invoice-Settings explizit leer, damit keine alten/globalen Stripe-Defaults
    // (z.B. §19 UStG / Platzhalter-USt-ID) in neu erzeugten Rechnungen landen.
    // Das ist besonders wichtig, weil Stripe bei Subscription-Erstellung sofort eine Invoice erzeugen kann
    // (auch bei Trial/0€), und dann ist es zu spät.
    await stripe.customers.update(customer.id, {
      invoice_settings: {
        footer: '',
        custom_fields: [],
      },
    })

    // M26 launch: 01.03.2026. Pre-launch signups get a short free trial until
    // 48h from now (Stripe minimum). After launch, no trial — charge immediately.
    const now = new Date()
    const launchDate = new Date('2026-03-01T00:00:00+01:00')
    const minTrialEnd = new Date(now.getTime() + 48 * 60 * 60 * 1000 + 60_000) // 48h + 1min buffer

    // Only add trial if we're still before launch AND the minimum trial end is reasonable
    const useTrialEnd = now < launchDate ? Math.floor(minTrialEnd.getTime() / 1000) : undefined

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
          price: priceId,
          quantity: 1,
        },
      ],
      subscription_data: {
        ...(useTrialEnd ? { trial_end: useTrialEnd } : {}),
        metadata: {
          userId: userId,
          signupType: now < launchDate ? "pre_launch_2026" : "launch_2026"
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

// ---------------------------------------------------------------------------
// PAT Raid Map (TradingView-Indikator, Einzelprodukt) — eigener Checkout.
// Price-IDs kommen ausschliesslich aus Env-Vars (siehe docs/RAIDMAP_STRIPE_SETUP.md):
//   STRIPE_PRICE_ID_RAIDMAP_MONTHLY, STRIPE_PRICE_ID_RAIDMAP_ANNUAL
// Internationale Zielgruppe: locale 'auto', USD-Preise, kein Trial.
// ---------------------------------------------------------------------------

export type RaidMapCheckoutTier = 'monthly' | 'annual'

export function getRaidMapPriceId(tier: RaidMapCheckoutTier): string | undefined {
  return tier === 'annual'
    ? process.env.STRIPE_PRICE_ID_RAIDMAP_ANNUAL
    : process.env.STRIPE_PRICE_ID_RAIDMAP_MONTHLY
}

export async function createRaidMapCheckoutSession(
  userId: string,
  userEmail: VerifiedEmailAddress,
  tier: RaidMapCheckoutTier
) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL
  if (!baseUrl) {
    throw new Error('Missing NEXT_PUBLIC_APP_URL environment variable')
  }

  const priceId = getRaidMapPriceId(tier)
  if (!priceId) {
    throw new Error(`Missing Stripe price id for raidmap tier "${tier}" (see docs/RAIDMAP_STRIPE_SETUP.md)`)
  }

  // Raid Map rechnet in USD, Mentorship-Customers tragen oft schon eine
  // EUR-Currency — Stripe verbietet Currency-Mix pro Customer ("You cannot
  // combine currencies on a single customer"). Deshalb bekommt Raid Map einen
  // EIGENEN Customer je User (metadata.raidmapUserId, bewusst OHNE userId-Key,
  // damit die Mentorship-Suchen ihn nie aufgreifen).
  let customer: Stripe.Customer
  const existingRaidmapCustomers = await stripe.customers.search({
    query: `metadata['raidmapUserId']:'${userId}'`,
  })
  if (existingRaidmapCustomers.data.length > 0) {
    customer = [...existingRaidmapCustomers.data].sort((a, b) => b.created - a.created)[0]
  } else {
    customer = await stripe.customers.create({
      email: userEmail,
      metadata: { raidmapUserId: userId },
    })
  }

  await stripe.customers.update(customer.id, {
    invoice_settings: {
      footer: '',
      custom_fields: [],
    },
  })

  const session = await stripe.checkout.sessions.create({
    customer: customer.id,
    payment_method_types: ['card'],
    mode: 'subscription',
    allow_promotion_codes: true,
    billing_address_collection: 'required',
    customer_update: {
      address: 'auto',
      name: 'auto',
    },
    locale: 'auto',
    automatic_tax: { enabled: true },
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    subscription_data: {
      trial_period_days: 7,
      metadata: {
        userId,
        product: 'raidmap',
        tier,
      },
    },
    // TradingView-Username fuer den Invite-Only-Grant direkt im Checkout erfassen
    custom_fields: [
      {
        key: 'tradingview_username',
        label: { type: 'custom', custom: 'TradingView username' },
        type: 'text',
      },
    ],
    success_url: `${baseUrl}/raid-map?checkout=success`,
    cancel_url: `${baseUrl}/raid-map?checkout=cancelled`,
    metadata: {
      userId,
      product: 'raidmap',
      tier,
    },
  })

  return { url: session.url }
}


// Billing-Portal fuer den separaten Raid-Map-Customer (siehe createRaidMapCheckoutSession)
export async function createRaidMapPortalSession(userId: string) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL
  if (!baseUrl) {
    throw new Error('Missing NEXT_PUBLIC_APP_URL environment variable')
  }

  const found = await stripe.customers.search({
    query: `metadata['raidmapUserId']:'${userId}'`,
  })
  if (found.data.length === 0) {
    throw new Error('No Raid Map customer found')
  }
  const customer = [...found.data].sort((a, b) => b.created - a.created)[0]

  const session = await stripe.billingPortal.sessions.create({
    customer: customer.id,
    return_url: `${baseUrl}/raid-map/account`,
    locale: 'auto',
  })

  if (!session.url) {
    throw new Error('Failed to create portal session')
  }

  return { url: session.url }
}
