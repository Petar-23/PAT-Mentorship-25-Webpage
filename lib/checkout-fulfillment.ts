import 'server-only'

// Freischaltung nach dem Gast-Checkout: schließt den Ablauf aus lib/checkout-fulfillment-flow.mjs an
// Stripe, Clerk, die Datenbank (CheckoutFulfillment, UserSubscription), den Mailversand
// (Google Workspace, lib/mailer.ts) und Telegram an. Aufrufer: Stripe-Webhook
// (lib/stripe-webhook-handler.ts) und /willkommen (lib/checkout-welcome.ts).
//
// Telegram bekommt nur Stripe-IDs und Status, keine Namen oder E-Mail-Adressen.

import type Stripe from 'stripe'
import { clerkClient } from '@clerk/nextjs/server'
import { getIsAdmin } from '@/lib/authz'
import { prisma, withPrismaRetry } from '@/lib/prisma'
import { stripe, getAccessPriceIdsFromEnv } from '@/lib/stripe'
import { upsertUserSubscription } from '@/lib/user-subscription-cache'
import { sendMail } from '@/lib/mailer'
import { sendCortanaTelegram } from '@/lib/telegram-notify'
import { SITE_URL } from '@/lib/legal-texts'
import { buildPaymentFailedMail, buildPurchaseConfirmationMail, greetingName } from '@/lib/checkout-mail'
import { CONTACT_EMAIL, escapeStripeSearchValue, sameEmail } from '@/lib/vertrag-erklaerung.mjs'
import { isProductScopedCustomer } from '@/lib/stripe-customer-scope.mjs'
import { LOGIN_LINK_SECONDS, SIGN_IN_TICKET_SECONDS } from '@/lib/checkout-guest.mjs'
import {
  fulfillCheckoutSessionFlow,
  handleAsyncPaymentFailedFlow,
  type FulfillmentDeps,
  type FulfillmentStore,
  type OnceField,
} from '@/lib/checkout-fulfillment-flow.mjs'

const MAIL_TIMEOUT_MS = 8_000
const MAX_DUPLICATE_CHECK_CUSTOMERS = 5

export function appBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/+$/, '')
  return configured || SITE_URL
}

// ---------------------------------------------------------------------------
// Datenbank
// ---------------------------------------------------------------------------

function isUniqueViolation(error: unknown) {
  return Boolean(error && typeof error === 'object' && (error as { code?: unknown }).code === 'P2002')
}

// Exportiert für den Integrationstest gegen eine lokale Postgres-Instanz.
export const store: FulfillmentStore = {
  async ensure(data) {
    const existing = await withPrismaRetry(
      () => prisma.checkoutFulfillment.findUnique({ where: { stripeSessionId: data.stripeSessionId } }),
      { label: 'Read checkout fulfillment' }
    )
    if (existing) return existing
    try {
      return await prisma.checkoutFulfillment.create({ data })
    } catch (error) {
      if (!isUniqueViolation(error)) throw error
      // Gleichzeitig angelegt (Webhook und /willkommen): die andere Zeile verwenden.
      const row = await prisma.checkoutFulfillment.findUnique({ where: { stripeSessionId: data.stripeSessionId } })
      if (!row) throw error
      return row
    }
  },

  async get(stripeSessionId) {
    return withPrismaRetry(() => prisma.checkoutFulfillment.findUnique({ where: { stripeSessionId } }), {
      label: 'Read checkout fulfillment',
    })
  },

  async claimAccount(stripeSessionId, now, staleBefore) {
    const result = await prisma.checkoutFulfillment.updateMany({
      where: {
        stripeSessionId,
        userId: null,
        OR: [{ accountClaimedAt: null }, { accountClaimedAt: { lt: staleBefore } }],
      },
      data: { accountClaimedAt: now },
    })
    return result.count === 1
  },

  async setAccount(stripeSessionId, data) {
    const result = await prisma.checkoutFulfillment.updateMany({
      where: { stripeSessionId, userId: null },
      data,
    })
    return result.count === 1
  },

  async claimMail(stripeSessionId, now, staleBefore) {
    const result = await prisma.checkoutFulfillment.updateMany({
      where: {
        stripeSessionId,
        welcomeEmailSentAt: null,
        OR: [{ welcomeEmailAttemptAt: null }, { welcomeEmailAttemptAt: { lt: staleBefore } }],
      },
      data: { welcomeEmailAttemptAt: now },
    })
    return result.count === 1
  },

  async markMailSent(stripeSessionId, now) {
    await withPrismaRetry(
      () => prisma.checkoutFulfillment.update({ where: { stripeSessionId }, data: { welcomeEmailSentAt: now } }),
      { label: 'Mark confirmation mail sent' }
    )
  },

  async claimOnce(stripeSessionId, field: OnceField, now) {
    const result = await prisma.checkoutFulfillment.updateMany({
      where: { stripeSessionId, [field]: null },
      data: { [field]: now },
    })
    return result.count === 1
  },
}

// ---------------------------------------------------------------------------
// Clerk
// ---------------------------------------------------------------------------

function clerkStatus(error: unknown): number | null {
  const status = error && typeof error === 'object' ? (error as { status?: unknown }).status : null
  return typeof status === 'number' ? status : null
}

async function isAdminSafe(userId: string) {
  try {
    return await getIsAdmin(userId)
  } catch (error) {
    console.error('[checkout] admin check failed (treated as no admin):', error)
    return false
  }
}

async function findAccountsByEmail(email: string) {
  const client = await clerkClient()
  const users = await client.users.getUserList({ emailAddress: [email], limit: 10 })
  const matches = []
  for (const user of users.data) {
    const verified = user.emailAddresses.some(
      (address) => sameEmail(address.emailAddress, email) && address.verification?.status === 'verified'
    )
    matches.push({ id: user.id, verified, isAdmin: verified ? await isAdminSafe(user.id) : false })
  }
  return matches
}

async function getAccount(userId: string) {
  try {
    const client = await clerkClient()
    const user = await client.users.getUser(userId)
    return { id: user.id, isAdmin: await isAdminSafe(user.id) }
  } catch (error) {
    if (clerkStatus(error) === 404) return null
    throw error
  }
}

async function createAccount({ email, name, stripeSessionId }: { email: string; name: string | null; stripeSessionId: string }) {
  const client = await clerkClient()
  const firstName = greetingName(name)
  const user = await client.users.createUser({
    emailAddress: [email],
    // Kein Passwort: Anmeldung per E-Mail-Code oder Einmal-Link (Clerk-Einstellung "Passwort optional").
    skipPasswordRequirement: true,
    ...(firstName ? { firstName } : {}),
    privateMetadata: { createdVia: 'guest_checkout', stripeCheckoutSessionId: stripeSessionId },
  })
  return { id: user.id }
}

async function createSignInToken(userId: string, expiresInSeconds: number) {
  const client = await clerkClient()
  const token = await client.signInTokens.createSignInToken({ userId, expiresInSeconds })
  return token.token
}

async function createLoginLink(userId: string) {
  const token = await createSignInToken(userId, LOGIN_LINK_SECONDS)
  // Token im Fragment: landet nicht in Server-Logs und wird nicht als Referrer weitergegeben.
  return `${appBaseUrl()}/willkommen/anmelden#ticket=${encodeURIComponent(token)}`
}

// ---------------------------------------------------------------------------
// Stripe
// ---------------------------------------------------------------------------

/**
 * Discord-Verknüpfung eines früheren Mentorship-Customers desselben Kontos. Der Gast-Checkout legt
 * immer einen neuen Stripe-Customer an. Ohne discordUserId daran setzen die Abo-Events im Webhook die
 * Mentee-Rolle nicht, anders als beim alten Kontoweg, der den bisherigen Customer wiederverwendet.
 */
async function findPreviousDiscordUserId(userId: string, excludeCustomerId: string): Promise<string | null> {
  try {
    const result = await stripe.customers.search({
      query: `metadata['userId']:'${escapeStripeSearchValue(userId)}'`,
      limit: 10,
    })
    const previous = result.data
      .filter((customer) => customer.id !== excludeCustomerId && !isProductScopedCustomer(customer))
      .filter((customer) => typeof customer.metadata?.discordUserId === 'string' && customer.metadata.discordUserId.length > 0)
      .sort((a, b) => b.created - a.created)[0]
    return previous?.metadata?.discordUserId ?? null
  } catch (error) {
    console.error('[checkout] previous Discord link lookup failed (non-fatal):', error)
    return null
  }
}

// Exportiert für lib/checkout-link-stripe.test.mjs.
export async function linkStripe({ customerId, subscriptionId, userId }: { customerId: string; subscriptionId: string; userId: string }) {
  const customer = await stripe.customers.retrieve(customerId)
  if (!('deleted' in customer && customer.deleted) && customer.metadata?.userId !== userId) {
    if (customer.metadata?.userId) {
      console.warn('[checkout] Stripe customer carried another metadata.userId, relinking:', customerId)
    }
    // Nur beim ersten Verknüpfen (danach stimmt metadata.userId): frühere Discord-Verknüpfung mitnehmen.
    // Muss vor dem Abo-Update unten stehen, dessen customer.subscription.updated die Rolle dann setzt.
    const discordUserId = customer.metadata?.discordUserId ? null : await findPreviousDiscordUserId(userId, customerId)
    await stripe.customers.update(customerId, { metadata: { userId, ...(discordUserId ? { discordUserId } : {}) } })
  }

  const subscription = await stripe.subscriptions.retrieve(subscriptionId)
  if (subscription.metadata?.userId !== userId) {
    await stripe.subscriptions.update(subscriptionId, { metadata: { userId } })
  }
}

function priceIdsOf(subscription: Stripe.Subscription): string[] {
  return (subscription.items?.data ?? [])
    .map((item) => (typeof item.price === 'string' ? item.price : item.price?.id))
    .filter((id): id is string => typeof id === 'string' && id.length > 0)
}

function mentorshipPriceIds(): string[] {
  const single = process.env.STRIPE_PRICE_ID?.split(',').map((id) => id.trim()).filter(Boolean) ?? []
  return Array.from(new Set([...getAccessPriceIdsFromEnv(), ...single]))
}

async function listSubscriptionsForDuplicateCheck({ userId, email, customerId }: { userId: string; email: string; customerId: string }) {
  const customerIds = new Set<string>([customerId])

  const row = await prisma.userSubscription.findUnique({ where: { userId }, select: { stripeCustomerId: true } })
  if (row?.stripeCustomerId) customerIds.add(row.stripeCustomerId)

  const byUser = await stripe.customers.search({ query: `metadata['userId']:'${escapeStripeSearchValue(userId)}'`, limit: 10 })
  const byEmail = await stripe.customers.search({ query: `email:'${escapeStripeSearchValue(email)}'`, limit: 10 })
  for (const customer of [...byUser.data, ...byEmail.data.filter((c) => sameEmail(c.email, email))]) {
    if ('deleted' in customer && customer.deleted) continue
    if (isProductScopedCustomer(customer)) continue
    customerIds.add(customer.id)
  }

  const subscriptions: Array<{ id: string; status: string; product: string | null; priceIds: string[] }> = []
  for (const id of Array.from(customerIds).slice(0, MAX_DUPLICATE_CHECK_CUSTOMERS)) {
    const list = await stripe.subscriptions.list({ customer: id, status: 'all', limit: 20 })
    for (const subscription of list.data) {
      subscriptions.push({
        id: subscription.id,
        status: subscription.status,
        product: typeof subscription.metadata?.product === 'string' ? subscription.metadata.product : null,
        priceIds: priceIdsOf(subscription),
      })
    }
  }

  const paypal = await prisma.payPalSubscriber.findFirst({
    where: {
      status: 'ACTIVE',
      OR: [{ userId }, { paypalEmail: { equals: email, mode: 'insensitive' } }],
    },
    select: { id: true },
  })

  return { subscriptions, paypalActive: Boolean(paypal), mentorshipPriceIds: mentorshipPriceIds() }
}

// ---------------------------------------------------------------------------
// Zusammenbau
// ---------------------------------------------------------------------------

function deps(): FulfillmentDeps {
  const siteUrl = appBaseUrl()
  return {
    now: () => new Date(),
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    store,
    retrieveSession: (sessionId) => stripe.checkout.sessions.retrieve(sessionId),
    retrieveSubscription: (subscriptionId) => stripe.subscriptions.retrieve(subscriptionId),
    getAccount,
    findAccountsByEmail,
    createAccount,
    createLoginLink,
    linkStripe,
    upsertSubscription: ({ userId, customerId, subscription }) =>
      upsertUserSubscription({ userId, stripeCustomerId: customerId, subscription }),
    listSubscriptionsForDuplicateCheck,
    buildConfirmationMail: (input) => buildPurchaseConfirmationMail({ ...input, siteUrl }),
    buildPaymentFailedMail: ({ name }) => buildPaymentFailedMail({ name, siteUrl }),
    sendMail: async (mail, tag) => {
      const result = await sendMail(
        { to: mail.to, replyTo: CONTACT_EMAIL, subject: mail.subject, text: mail.text, html: mail.html },
        { tag, timeoutMs: MAIL_TIMEOUT_MS }
      )
      return result.ok ? { ok: true as const } : { ok: false as const, reason: result.reason }
    },
    notify: (lines) => sendCortanaTelegram(lines.join('\n')),
  }
}

/**
 * Checkout-Session aus /api/checkout/start freischalten (idempotent). Andere Sessions (alter Kontoweg,
 * Raid Map, Research, nicht abgeschlossene) liefern status 'skipped'.
 * @param options.defer Nebenwirkungen (Mail, Doppel-Abo-Meldung) nach der Antwort ausführen.
 * @param options.session bereits frisch geholte Session, spart einen Stripe-Aufruf.
 */
export function fulfillCheckoutSession(
  sessionId: string,
  options: { defer?: (task: () => Promise<unknown>) => void; session?: Stripe.Checkout.Session } = {}
) {
  const base = deps()
  const withSession: FulfillmentDeps = options.session
    ? {
        ...base,
        retrieveSession: async (id) => (id === options.session?.id ? options.session : base.retrieveSession(id)),
      }
    : base
  return fulfillCheckoutSessionFlow(sessionId, withSession, { defer: options.defer })
}

/** checkout.session.async_payment_failed: Cache aktualisieren, Petar und Käufer informieren (je einmal). */
export function handleCheckoutAsyncPaymentFailed(sessionId: string) {
  return handleAsyncPaymentFailedFlow(sessionId, deps())
}

/**
 * Einmal-Ticket für die automatische Anmeldung auf /willkommen. Setzt ticketIssuedAt vorher per
 * bedingtem Update, damit höchstens ein Ticket je Kauf entsteht. null, wenn schon vergeben oder Fehler.
 */
export async function issueSignInTicket(stripeSessionId: string, userId: string): Promise<string | null> {
  const claimed = await store.claimOnce(stripeSessionId, 'ticketIssuedAt', new Date())
  if (!claimed) return null
  try {
    return await createSignInToken(userId, SIGN_IN_TICKET_SECONDS)
  } catch (error) {
    console.error('[checkout] sign-in ticket failed:', error)
    return null
  }
}

/** true genau beim ersten Aufruf je Session: dann darf der Browser das purchase-Event senden. */
export async function claimPurchaseTracking(stripeSessionId: string): Promise<boolean> {
  try {
    return await store.claimOnce(stripeSessionId, 'purchaseTrackedAt', new Date())
  } catch (error) {
    console.error('[checkout] purchase tracking claim failed:', error)
    return false
  }
}
