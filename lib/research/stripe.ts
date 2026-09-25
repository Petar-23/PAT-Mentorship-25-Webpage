import 'server-only'

import type Stripe from 'stripe'
import { prisma, withPrismaRetry } from '@/lib/prisma'
import { computeResearchAccess } from '@/lib/research/access-rules.mjs'
import {
  RESEARCH_CUSTOMER_METADATA_KEY,
  RESEARCH_PORTAL_CONFIGURATION_ENV,
  RESEARCH_PRODUCT,
  RESEARCH_TIER_DETAILS,
  getResearchPriceId,
  isResearchInterval,
  isResearchTier,
  type ResearchInterval,
  type ResearchTier,
} from '@/lib/research/config.mjs'
import { recordResearchConsent } from '@/lib/research/consent'
import {
  findOpenResearchSubscription,
  mapStripeSubscriptionToResearchRow,
  pickResearchFallbackSubscription,
  resolveResearchSubscriptionPrice,
  shouldReplaceResearchSubscription,
} from '@/lib/research/subscription-sync.mjs'
import { stripe } from '@/lib/stripe'
import { sendCortanaTelegram } from '@/lib/telegram-notify'

// PAT Research — Stripe-Anbindung (Raid-Map-Muster, aber gehärtet):
// - eigener USD-Customer je User (metadata.researchUserId, NIE metadata.userId,
//   damit die Mentorship-Suchen ihn nicht aufgreifen und kein Währungsmix entsteht)
// - Checkout mit Pflicht-Einwilligungen (vorher auf der Pricing-Seite protokolliert)
// - Cache ResearchSubscription wird immer FRISCH aus Stripe synchronisiert,
//   damit die Reihenfolge der Webhook-Events keine Rolle spielt
// Keine E-Mail-Adressen in Logs oder Telegram-Nachrichten (nur die Domain).

export type ResearchStripeErrorCode =
  | 'not_configured'
  | 'missing_price'
  | 'no_customer'
  | 'foreign_session'
  | 'not_research'
  | 'already_subscribed'

export class ResearchStripeError extends Error {
  readonly code: ResearchStripeErrorCode
  /** Nur bei `already_subscribed`: Status der blockierenden Subscription. */
  readonly subscriptionStatus?: string

  constructor(code: ResearchStripeErrorCode, message?: string, details?: { subscriptionStatus?: string }) {
    super(message ?? code)
    this.name = 'ResearchStripeError'
    this.code = code
    if (details?.subscriptionStatus) this.subscriptionStatus = details.subscriptionStatus
  }
}

/** Duck-typed, damit die Prüfung auch über Modul-Instanzen hinweg hält. */
export function isResearchStripeError(
  error: unknown,
  code?: ResearchStripeErrorCode
): error is ResearchStripeError {
  if (!(error instanceof Error) || error.name !== 'ResearchStripeError') return false
  const errorCode = (error as { code?: unknown }).code
  return typeof errorCode === 'string' && (code === undefined || errorCode === code)
}

// Stripe-Fehlermeldungen können E-Mail-Adressen enthalten (z. B. bei ungültigen
// Customer-Daten). Für Logs daher nur Typ/Code und eine bereinigte Meldung.
const EMAIL_PATTERN = /[^\s@<>"'(),;:]+@[^\s@<>"'(),;:]+/g

export function describeResearchErrorForLog(error: unknown): Record<string, string | number | undefined> {
  if (!(error instanceof Error)) return { message: 'Non-error thrown' }
  const details = error as Error & { code?: unknown; type?: unknown; statusCode?: unknown; requestId?: unknown }
  return {
    name: error.name,
    message: error.message.replace(EMAIL_PATTERN, '[email]').slice(0, 300),
    code: typeof details.code === 'string' ? details.code : undefined,
    type: typeof details.type === 'string' ? details.type : undefined,
    statusCode: typeof details.statusCode === 'number' ? details.statusCode : undefined,
    requestId: typeof details.requestId === 'string' ? details.requestId : undefined,
  }
}

// Clerk-User-IDs ("user_…"). Wird in eine Stripe-Search-Query interpoliert,
// deshalb strikt geprüft (keine Anführungszeichen o. Ä.).
const CLERK_USER_ID_PATTERN = /^user_[A-Za-z0-9]{1,200}$/
const SUBSCRIPTION_ID_PATTERN = /^sub_[A-Za-z0-9]{1,200}$/
const CHECKOUT_SESSION_ID_PATTERN = /^cs_[A-Za-z0-9_]{1,250}$/

// Wortlaut neben dem Bezahl-Button (Stripe `custom_text.submit`, max. 300
// Zeichen hier). Wiederholt den Widerrufsverzicht, der vorher auf der
// Pricing-Seite per Checkbox abgefragt und protokolliert wurde.
export const RESEARCH_CHECKOUT_SUBMIT_MESSAGE =
  'You request immediate access to PAT Research and acknowledge that your right of withdrawal expires once access begins. The membership renews automatically until you cancel; you can cancel anytime in your account, effective at the end of the paid period.'

function assertClerkUserId(userId: string) {
  if (typeof userId !== 'string' || !CLERK_USER_ID_PATTERN.test(userId)) {
    throw new Error('Invalid research user id')
  }
}

function assertStripeConfigured() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new ResearchStripeError('not_configured', 'Stripe is not configured')
  }
}

function assertAbsoluteHttpUrl(value: string, label: string) {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new Error(`Invalid ${label}`)
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error(`Invalid ${label}`)
}

function idOf(value: string | { id: string } | null | undefined): string | null {
  if (!value) return null
  const id = typeof value === 'string' ? value : value.id
  return typeof id === 'string' && id.length > 0 ? id : null
}

function emailDomain(email: string | null | undefined): string {
  if (typeof email !== 'string') return '?'
  const at = email.lastIndexOf('@')
  const domain = at >= 0 ? email.slice(at + 1).trim().toLowerCase() : ''
  return domain.length > 0 ? domain : '?'
}

function formatAmount(amountCents: number | null | undefined, currency: string | null | undefined): string {
  const amount = typeof amountCents === 'number' && Number.isFinite(amountCents) ? amountCents / 100 : 0
  return `${amount.toFixed(2)} ${(currency ?? 'usd').toUpperCase()}`
}

function planLabel(tier: unknown, interval: unknown): string {
  const tierLabel = isResearchTier(tier) ? RESEARCH_TIER_DETAILS[tier].label : '?'
  const intervalLabel = interval === 'year' ? 'jährlich' : interval === 'month' ? 'monatlich' : '?'
  return `${tierLabel} · ${intervalLabel}`
}

async function notifyCortana(text: string) {
  try {
    await sendCortanaTelegram(text)
  } catch (error) {
    console.error('[research] Telegram notify failed (non-fatal):', describeResearchErrorForLog(error))
  }
}

// ---------------------------------------------------------------------------
// Customer
// ---------------------------------------------------------------------------

/** Vorhandener Research-Customer des Users (Cache, dann Stripe-Suche) oder null. */
async function findResearchCustomerId(userId: string): Promise<string | null> {
  assertClerkUserId(userId)

  const row = await withPrismaRetry(
    () =>
      prisma.researchSubscription.findUnique({
        where: { userId },
        select: { stripeCustomerId: true },
      }),
    { label: 'Read research customer' }
  )
  if (row?.stripeCustomerId) return row.stripeCustomerId

  const found = await stripe.customers.search({
    query: `metadata['${RESEARCH_CUSTOMER_METADATA_KEY}']:'${userId}'`,
    limit: 10,
  })
  const newest = found.data
    .filter((customer) => !('deleted' in customer && customer.deleted))
    .sort((a, b) => b.created - a.created)[0]

  return newest?.id ?? null
}

/**
 * Research-Customer des Users finden oder anlegen. Setzt NIE metadata.userId.
 * Der Idempotency-Key verhindert Doppel-Customers, wenn zwei Checkouts
 * schneller kommen, als Stripes Suchindex nachzieht.
 */
export async function findOrCreateResearchCustomer(userId: string, email: string): Promise<string> {
  assertClerkUserId(userId)
  if (typeof email !== 'string' || email.trim().length === 0) {
    throw new Error('Missing email for research customer')
  }

  let customerId = await findResearchCustomerId(userId)
  if (!customerId) {
    const created = await stripe.customers.create(
      {
        email: email.trim(),
        preferred_locales: ['en'],
        metadata: { [RESEARCH_CUSTOMER_METADATA_KEY]: userId },
      },
      { idempotencyKey: `research-customer-v1-${userId}` }
    )
    customerId = created.id
  }

  // Wie beim Raid-Map-Checkout: Invoice-Settings explizit leeren, damit keine
  // alten/globalen Stripe-Defaults (z. B. §19 UStG) in Rechnungen landen.
  await stripe.customers.update(customerId, {
    invoice_settings: {
      footer: '',
      custom_fields: [],
    },
  })

  return customerId
}

// ---------------------------------------------------------------------------
// Checkout und Portal
// ---------------------------------------------------------------------------

// Stripe erlaubt 30 min bis 24 h (Default 24 h). Kurz halten, damit ein
// vergessener Tab nicht noch Stunden später bezahlt werden kann; die 5 min
// über dem Minimum fangen Uhrabweichung und Latenz ab.
export const RESEARCH_CHECKOUT_SESSION_TTL_SECONDS = 35 * 60

/** Schließt alle offenen Research-Checkout-Sessions des Customers. */
async function expireOpenResearchCheckoutSessions(customerId: string): Promise<void> {
  const open = await stripe.checkout.sessions.list({ customer: customerId, status: 'open', limit: 100 })
  for (const session of open.data) {
    if (session.metadata?.product !== RESEARCH_PRODUCT) continue
    try {
      await stripe.checkout.sessions.expire(session.id)
    } catch (error) {
      // Inzwischen abgeschlossen oder abgelaufen: nichts mehr zu schließen
      // (ein daraus entstandenes Abo findet die folgende Abo-Prüfung).
      const current = await stripe.checkout.sessions.retrieve(session.id)
      if (current.status === 'open') throw error
    }
  }
}

async function findOpenResearchSubscriptionForCustomer(customerId: string): Promise<Stripe.Subscription | null> {
  const subscriptions = await stripe.subscriptions.list({ customer: customerId, status: 'all', limit: 100 })
  return findOpenResearchSubscription(subscriptions.data)
}

export async function createResearchCheckoutSession(params: {
  userId: string
  email: string
  tier: ResearchTier
  interval: ResearchInterval
  consentReference: string
  successUrl: string
  cancelUrl: string
}): Promise<{ url: string; sessionId: string }> {
  const { userId, email, tier, interval, consentReference, successUrl, cancelUrl } = params

  assertClerkUserId(userId)
  if (!isResearchTier(tier) || !isResearchInterval(interval)) {
    throw new ResearchStripeError('missing_price', 'Unknown research tier or interval')
  }
  if (typeof consentReference !== 'string' || consentReference.trim().length === 0) {
    throw new Error('Missing consent reference')
  }
  assertAbsoluteHttpUrl(successUrl, 'success url')
  assertAbsoluteHttpUrl(cancelUrl, 'cancel url')
  if (!successUrl.includes('{CHECKOUT_SESSION_ID}')) {
    throw new Error('Research success url must contain {CHECKOUT_SESSION_ID}')
  }

  assertStripeConfigured()
  const priceId = getResearchPriceId(tier, interval, process.env)
  if (!priceId) {
    throw new ResearchStripeError('missing_price', `No Stripe price configured for research ${tier}/${interval}`)
  }

  const customer = await findOrCreateResearchCustomer(userId, email)

  // Doppel-Abos verhindern (der DB-Cache in der Route allein reicht nicht):
  // 1. ältere, noch bezahlbare Research-Sessions dieses Customers schließen
  //    (sonst kann ein alter Tab später ein zweites Abo abschließen),
  // 2. danach Stripe selbst fragen, ob noch ein Abo läuft oder Geld einziehen
  //    kann (auch past_due nach Ablauf der Kulanz, unpaid, incomplete).
  // Diese Reihenfolge fängt auch eine Session, die gerade noch abgeschlossen wurde.
  await expireOpenResearchCheckoutSessions(customer)
  const open = await findOpenResearchSubscriptionForCustomer(customer)
  if (open) {
    throw new ResearchStripeError('already_subscribed', 'The research customer already has an open subscription', {
      subscriptionStatus: open.status,
    })
  }

  const metadata = { userId, product: RESEARCH_PRODUCT, tier, interval }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer,
    expires_at: Math.floor(Date.now() / 1000) + RESEARCH_CHECKOUT_SESSION_TTL_SECONDS,
    line_items: [{ price: priceId, quantity: 1 }],
    locale: 'en',
    payment_method_types: ['card'],
    allow_promotion_codes: true,
    billing_address_collection: 'required',
    customer_update: { address: 'auto', name: 'auto' },
    automatic_tax: { enabled: process.env.RESEARCH_STRIPE_AUTOMATIC_TAX !== '0' },
    client_reference_id: userId,
    subscription_data: { metadata },
    metadata: { ...metadata, consentReference },
    custom_text: { submit: { message: RESEARCH_CHECKOUT_SUBMIT_MESSAGE } },
    success_url: successUrl,
    cancel_url: cancelUrl,
  })

  if (!session.url) throw new Error('Stripe returned a research checkout session without url')
  return { url: session.url, sessionId: session.id }
}

export async function createResearchPortalSession(params: {
  userId: string
  returnUrl: string
}): Promise<{ url: string }> {
  const { userId, returnUrl } = params
  assertClerkUserId(userId)
  assertAbsoluteHttpUrl(returnUrl, 'return url')
  assertStripeConfigured()

  const customerId = await findResearchCustomerId(userId)
  if (!customerId) throw new ResearchStripeError('no_customer', 'No research customer for this user')

  const configuration = process.env[RESEARCH_PORTAL_CONFIGURATION_ENV]?.trim()
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
    locale: 'en',
    ...(configuration ? { configuration } : {}),
  })

  if (!session.url) throw new Error('Stripe returned a research portal session without url')
  return { url: session.url }
}

// ---------------------------------------------------------------------------
// Subscription-Sync (Webhook und /welcome)
// ---------------------------------------------------------------------------

export type ResearchSyncResult = {
  action: 'upserted' | 'skipped'
  reason?: string
}

type MappedResearchRow = Extract<ReturnType<typeof mapStripeSubscriptionToResearchRow>, { ok: true }>['row']

type PersistOutcome = {
  result: ResearchSyncResult
  /** Andere Subscription desselben Users, die ebenfalls Zugang gibt (Doppel-Abo). */
  doubleActiveWith: string | null
  /** Subscription, die nach diesem Sync im Cache steht. */
  cachedSubscriptionId: string | null
}

function isUniqueConstraintError(error: unknown) {
  return Boolean(error && typeof error === 'object' && (error as { code?: unknown }).code === 'P2002')
}

// Frisch gemappte Zeilen haben noch kein updatedAt; bei past_due ist
// pastDueSince ohnehin gesetzt.
function grantsResearchAccess(row: MappedResearchRow, nowMs: number): boolean {
  return computeResearchAccess({ ...row, updatedAt: new Date(nowMs) }, nowMs).hasAccess
}

/** Anderes laufendes Research-Abo desselben Users beim selben Customer (oder null). */
async function findResearchFallbackSubscription(params: {
  customerId: string
  userId: string
  excludeSubscriptionId: string
  nowMs: number
}): Promise<Stripe.Subscription | null> {
  const subscriptions = await stripe.subscriptions.list({ customer: params.customerId, status: 'all', limit: 100 })
  return pickResearchFallbackSubscription(subscriptions.data, {
    env: process.env,
    nowMs: params.nowMs,
    userId: params.userId,
    excludeSubscriptionId: params.excludeSubscriptionId,
  })
}

async function persistResearchSubscription(subscription: Stripe.Subscription): Promise<ResearchSyncResult> {
  const nowMs = Date.now()
  const precheck = mapStripeSubscriptionToResearchRow(subscription, { env: process.env, nowMs })
  if (!precheck.ok) {
    console.warn('[research] subscription sync skipped', { subscriptionId: subscription.id, reason: precheck.reason })
    return { action: 'skipped', reason: precheck.reason }
  }
  const userId = precheck.userId

  // Verliert diese Subscription den Zugang (gekündigt, abgelaufen, unbezahlt …),
  // kann der User noch ein ANDERES laufendes Research-Abo haben — z. B. nach
  // einem Doppel-Abo, dessen neueres (gecachtes) Abo storniert wurde. Das steht
  // nur in Stripe; ohne diesen Blick bliebe der User bis zum nächsten Event des
  // anderen Abos ausgesperrt (bei Jahresabos bis zu einem Jahr).
  // Stripe-Aufruf bewusst vor der DB-Transaktion.
  const fallback = grantsResearchAccess(precheck.row, nowMs)
    ? null
    : await findResearchFallbackSubscription({
        customerId: precheck.row.stripeCustomerId,
        userId,
        excludeSubscriptionId: subscription.id,
        nowMs,
      })

  // Zwei parallele Events derselben neuen Subscription können beide "keine
  // Zeile" sehen; der zweite Insert scheitert dann am Unique-Index und wird
  // einmal wiederholt (liest dann die Zeile des ersten).
  for (let attempt = 1; ; attempt++) {
    try {
      const outcome = await withPrismaRetry(
        () =>
          prisma.$transaction(async (tx): Promise<PersistOutcome> => {
            const existing = await tx.researchSubscription.findUnique({ where: { userId } })
            const cachedBefore = existing?.stripeSubscriptionId ?? null
            const mapped = mapStripeSubscriptionToResearchRow(subscription, { env: process.env, nowMs, existing })
            if (!mapped.ok) {
              return { result: { action: 'skipped', reason: mapped.reason }, doubleActiveWith: null, cachedSubscriptionId: cachedBefore }
            }

            const owner = await tx.researchSubscription.findUnique({
              where: { stripeSubscriptionId: subscription.id },
              select: { userId: true },
            })
            if (owner && owner.userId !== userId) {
              return {
                result: { action: 'skipped', reason: 'subscription_owned_by_other_user' },
                doubleActiveWith: null,
                cachedSubscriptionId: cachedBefore,
              }
            }

            if (fallback) {
              const fallbackMapped = mapStripeSubscriptionToResearchRow(fallback, { env: process.env, nowMs, existing })
              const fallbackOwner = await tx.researchSubscription.findUnique({
                where: { stripeSubscriptionId: fallback.id },
                select: { userId: true },
              })
              // Steht gerade DIESE (jetzt zugangslose) Subscription im Cache,
              // zählt ihr frischer Stand, nicht der veraltete Cache-Eintrag.
              const current =
                existing && existing.stripeSubscriptionId === subscription.id
                  ? { ...existing, ...mapped.row, updatedAt: new Date(nowMs) }
                  : existing
              if (
                fallbackMapped.ok &&
                fallbackMapped.userId === userId &&
                (!fallbackOwner || fallbackOwner.userId === userId) &&
                shouldReplaceResearchSubscription(current, fallbackMapped.row, nowMs)
              ) {
                await tx.researchSubscription.upsert({
                  where: { userId },
                  create: { userId, ...fallbackMapped.row },
                  update: fallbackMapped.row,
                })
                // Stand der Ersatz schon im Cache, wurde er nur aufgefrischt.
                return {
                  result: {
                    action: 'upserted',
                    reason: cachedBefore === fallback.id ? 'existing_subscription_preferred' : 'fallback_subscription',
                  },
                  doubleActiveWith: null,
                  cachedSubscriptionId: fallback.id,
                }
              }
            }

            const doubleActiveWith =
              existing !== null &&
              existing.stripeSubscriptionId !== subscription.id &&
              computeResearchAccess(existing, nowMs).hasAccess &&
              grantsResearchAccess(mapped.row, nowMs)
                ? existing.stripeSubscriptionId
                : null

            if (!shouldReplaceResearchSubscription(existing, mapped.row, nowMs)) {
              return {
                result: { action: 'skipped', reason: 'existing_subscription_preferred' },
                doubleActiveWith,
                cachedSubscriptionId: cachedBefore,
              }
            }

            await tx.researchSubscription.upsert({
              where: { userId },
              create: { userId, ...mapped.row },
              update: mapped.row,
            })
            return { result: { action: 'upserted' }, doubleActiveWith, cachedSubscriptionId: subscription.id }
          }),
        { label: 'Sync research subscription' }
      )

      if (outcome.result.reason === 'subscription_owned_by_other_user') {
        console.warn('[research] subscription belongs to another user row — skip', {
          subscriptionId: subscription.id,
          userId,
        })
      }
      if (outcome.result.reason === 'fallback_subscription') {
        console.warn('[research] subscription lost access — cache switched to another active research subscription', {
          userId,
          subscriptionId: subscription.id,
          cachedSubscriptionId: outcome.cachedSubscriptionId,
        })
      }
      if (outcome.doubleActiveWith) {
        // Zwei laufende Research-Abos für denselben User = doppelte Abbuchung.
        // Beide IDs nennen: wird das gecachte storniert, wechselt der Cache
        // automatisch auf das verbleibende (siehe Fallback oben).
        console.warn('[research] two active research subscriptions for one user', {
          userId,
          subscriptionIds: [outcome.doubleActiveWith, subscription.id],
          cachedSubscriptionId: outcome.cachedSubscriptionId,
        })
        await notifyCortana(
          [
            '⚠️ PAT Research: zwei aktive Abos für denselben User',
            `User: ${userId}`,
            `Abos: ${outcome.doubleActiveWith} und ${subscription.id}`,
            `Im Cache (gibt Zugang): ${outcome.cachedSubscriptionId ?? '?'}`,
            'Bitte in Stripe prüfen und EINES kündigen/erstatten — der Zugang wechselt danach automatisch auf das verbleibende Abo.',
          ].join('\n')
        )
      }
      console.log('[research] subscription sync', {
        subscriptionId: subscription.id,
        status: subscription.status,
        action: outcome.result.action,
        reason: outcome.result.reason,
        cachedSubscriptionId: outcome.cachedSubscriptionId,
      })
      return outcome.result
    } catch (error) {
      if (attempt < 2 && isUniqueConstraintError(error)) continue
      throw error
    }
  }
}

/**
 * Holt die Subscription frisch von Stripe und schreibt sie in den Cache.
 * Fehler werden nicht abgefangen: im Webhook führt das zu einem Stripe-Retry.
 */
export async function syncResearchSubscriptionById(subscriptionId: string): Promise<ResearchSyncResult> {
  if (typeof subscriptionId !== 'string' || !SUBSCRIPTION_ID_PATTERN.test(subscriptionId)) {
    throw new Error('Invalid Stripe subscription id')
  }
  const subscription = await stripe.subscriptions.retrieve(subscriptionId)
  return persistResearchSubscription(subscription)
}

/** Webhook: customer.subscription.created / updated / deleted mit metadata.product = 'research'. */
export async function handleResearchSubscriptionEvent(subscription: Stripe.Subscription): Promise<ResearchSyncResult> {
  return syncResearchSubscriptionById(subscription.id)
}

/**
 * Webhook: checkout.session.completed mit metadata.product = 'research'.
 * Sync-Fehler werden weitergereicht (Stripe wiederholt das Event);
 * die Telegram-Benachrichtigung ist nie fatal.
 */
export async function handleResearchCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
  const metadata = session.metadata ?? {}
  if (metadata.product !== RESEARCH_PRODUCT) {
    throw new ResearchStripeError('not_research', 'Checkout session is not a research checkout')
  }

  const subscriptionId = idOf(session.subscription)
  if (subscriptionId) {
    await syncResearchSubscriptionById(subscriptionId)
  }

  const userId = typeof metadata.userId === 'string' && metadata.userId.trim() ? metadata.userId.trim() : null
  if (!userId) {
    console.warn('[research] checkout.session.completed without metadata.userId', { sessionId: session.id })
    return
  }

  const reference =
    typeof metadata.consentReference === 'string' && metadata.consentReference.trim()
      ? metadata.consentReference.trim()
      : session.id

  // Stripe kann dasselbe Event mehrfach zustellen: kein zweiter Log-Eintrag,
  // keine zweite Nachricht.
  const alreadyRecorded = await withPrismaRetry(
    () =>
      prisma.researchConsentEvent.findFirst({
        where: { userId, kind: 'checkout_completed', reference },
        select: { id: true },
      }),
    { label: 'Check research checkout consent' }
  )
  if (alreadyRecorded) return

  await recordResearchConsent({
    userId,
    kind: 'checkout_completed',
    reference,
    metadata: { sessionId: session.id, subscriptionId },
  })

  await notifyCortana(
    `🔬 PAT Research: neues Abo\nPlan: ${planLabel(metadata.tier, metadata.interval)} · ${formatAmount(session.amount_total, session.currency)}\nE-Mail-Domain: ${emailDomain(session.customer_details?.email ?? session.customer_email)}`
  )
}

/** Webhook: invoice.paid einer Research-Subscription → Petars Cortana-Telegram. Nie fatal. */
export async function notifyResearchInvoicePaid(invoice: Stripe.Invoice, subscription: Stripe.Subscription): Promise<void> {
  const reason =
    invoice.billing_reason === 'subscription_create'
      ? 'Erstzahlung'
      : invoice.billing_reason === 'subscription_cycle'
        ? 'Verlängerung'
        : invoice.billing_reason === 'subscription_update'
          ? 'Planwechsel'
          : invoice.billing_reason ?? '?'

  // Plan aus dem aktuellen Preis: metadata.tier/interval stammen vom Checkout
  // und bleiben bei einem Planwechsel im Portal unverändert (Fallback nur für
  // unbekannte Preise).
  const price = resolveResearchSubscriptionPrice(subscription, process.env)
  const plan = planLabel(price?.tier ?? subscription.metadata?.tier, price?.interval ?? subscription.metadata?.interval)

  await notifyCortana(
    `💰 PAT Research Zahlung eingegangen\n${formatAmount(invoice.amount_paid, invoice.currency)} · ${plan} · ${reason}\nE-Mail-Domain: ${emailDomain(invoice.customer_email)}`
  )
}

// ---------------------------------------------------------------------------
// /welcome: sofortiger Sync nach dem Checkout (ohne auf den Webhook zu warten)
// ---------------------------------------------------------------------------

export type ResearchCheckoutSyncStatus = 'active' | 'pending' | 'failed'

const FAILED_SUBSCRIPTION_STATUSES = new Set(['incomplete_expired', 'canceled', 'unpaid'])

function isStripeResourceMissing(error: unknown) {
  if (!error || typeof error !== 'object') return false
  const details = error as { code?: unknown; statusCode?: unknown }
  return details.code === 'resource_missing' || details.statusCode === 404
}

export async function syncResearchCheckoutSessionForUser(params: {
  sessionId: string
  userId: string
}): Promise<{ status: ResearchCheckoutSyncStatus }> {
  const { sessionId, userId } = params
  assertClerkUserId(userId)
  if (typeof sessionId !== 'string' || !CHECKOUT_SESSION_ID_PATTERN.test(sessionId)) {
    throw new ResearchStripeError('foreign_session', 'Invalid checkout session id')
  }

  let session: Stripe.Checkout.Session
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId)
  } catch (error) {
    if (isStripeResourceMissing(error)) {
      throw new ResearchStripeError('foreign_session', 'Unknown checkout session')
    }
    throw error
  }

  if (session.metadata?.product !== RESEARCH_PRODUCT || session.metadata?.userId !== userId) {
    throw new ResearchStripeError('foreign_session', 'Checkout session belongs to another user or product')
  }

  const subscriptionId = idOf(session.subscription)
  if (subscriptionId) {
    await syncResearchSubscriptionById(subscriptionId)
  }

  const row = await withPrismaRetry(
    () => prisma.researchSubscription.findUnique({ where: { userId } }),
    { label: 'Read research subscription after checkout' }
  )
  if (computeResearchAccess(row, Date.now()).hasAccess) return { status: 'active' }
  if (session.status === 'expired') return { status: 'failed' }
  if (
    row &&
    subscriptionId &&
    row.stripeSubscriptionId === subscriptionId &&
    FAILED_SUBSCRIPTION_STATUSES.has(row.status)
  ) {
    return { status: 'failed' }
  }
  return { status: 'pending' }
}
