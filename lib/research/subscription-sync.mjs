// Stripe-Subscription → ResearchSubscription-Zeile (reine Funktionen, ohne
// Server-Abhängigkeiten, per node:test abgedeckt).
//
// Der Webhook-Zweig (lib/research/stripe.ts) holt die Subscription immer frisch
// von Stripe und schreibt sie über diese Funktionen in den Cache. Damit spielt
// die Reihenfolge der Events keine Rolle — mit einer Ausnahme, die
// shouldReplaceResearchSubscription abdeckt: Events einer ALTEN Subscription
// dürfen eine neuere, noch laufende Subscription desselben Users nie verdrängen.

import { computeResearchAccess } from './access-rules.mjs'
import { RESEARCH_PRODUCT, getResearchTierProductId, isResearchInterval, isResearchTier, resolveResearchPrice } from './config.mjs'

/** @typedef {import('./config.mjs').ResearchTier} ResearchTier */
/** @typedef {import('./config.mjs').ResearchInterval} ResearchInterval */

/**
 * Der Teil einer Stripe-Subscription, den wir lesen. Bewusst locker typisiert,
 * damit sowohl `Stripe.Subscription` als auch Test-Fixtures passen.
 *
 * @typedef {Object} StripeSubscriptionLike
 * @property {string} id
 * @property {string} status
 * @property {string | { id: string } | null} [customer]
 * @property {Record<string, string> | null} [metadata]
 * @property {boolean | null} [cancel_at_period_end]
 * @property {number | null} [cancel_at]
 * @property {number | null} [current_period_end]
 * @property {number | null} [created]
 * @property {{ data?: ReadonlyArray<StripeSubscriptionItemLike> } | null} [items]
 */

/**
 * @typedef {Object} StripeSubscriptionItemLike
 * @property {string | StripePriceLike | null} [price]
 * @property {number | null} [current_period_end] Ab API-Version 2025-03-31 liegt das Periodenende am Item.
 */

/**
 * @typedef {Object} StripePriceLike
 * @property {string} id
 * @property {string | { id: string } | null} [product]
 * @property {Record<string, string> | null} [metadata]
 */

/**
 * Exakt die Prisma-Spalten von ResearchSubscription (ohne userId/id/Zeitstempel).
 *
 * @typedef {Object} ResearchSubscriptionRow
 * @property {string} stripeCustomerId
 * @property {string} stripeSubscriptionId
 * @property {string} status
 * @property {ResearchTier | null} tier
 * @property {ResearchInterval | null} billingInterval
 * @property {string | null} priceId
 * @property {boolean} cancelAtPeriodEnd
 * @property {Date | null} cancelAt
 * @property {Date | null} currentPeriodEnd
 * @property {Date | null} pastDueSince
 * @property {Date | null} stripeCreatedAt
 */

/**
 * Eine bereits gespeicherte Zeile (Prisma-Ergebnis oder Test-Fixture).
 *
 * @typedef {Object} ExistingResearchSubscription
 * @property {string} stripeSubscriptionId
 * @property {string} status
 * @property {string | null} [tier]
 * @property {string | null} [billingInterval]
 * @property {boolean | null} [cancelAtPeriodEnd]
 * @property {Date | null} [cancelAt]
 * @property {Date | null} [currentPeriodEnd]
 * @property {Date | null} [pastDueSince]
 * @property {Date | null} [stripeCreatedAt]
 * @property {Date | null} [updatedAt]
 */

/**
 * @typedef {'invalid_subscription'
 *   | 'not_research'
 *   | 'missing_user_id'
 *   | 'missing_customer'
 *   | 'missing_status'} ResearchSubscriptionSkipReason
 */

/**
 * @typedef {{ ok: true, userId: string, row: ResearchSubscriptionRow }
 *   | { ok: false, reason: ResearchSubscriptionSkipReason }} ResearchSubscriptionMapping
 */

/** @param {unknown} value @returns {string | null} */
function idOf(value) {
  if (typeof value === 'string') return value.length > 0 ? value : null
  if (value && typeof value === 'object' && 'id' in value) {
    const id = /** @type {{ id: unknown }} */ (value).id
    return typeof id === 'string' && id.length > 0 ? id : null
  }
  return null
}

/** @param {unknown} unix Stripe-Zeitstempel in Sekunden @returns {Date | null} */
function unixToDate(unix) {
  if (typeof unix !== 'number' || !Number.isFinite(unix) || unix <= 0) return null
  return new Date(unix * 1000)
}

/** @param {unknown} value @returns {number} */
function timeOf(value) {
  if (!(value instanceof Date)) return 0
  const ms = value.getTime()
  return Number.isFinite(ms) ? ms : 0
}

/** @param {unknown} value @returns {value is Date} */
function isValidDate(value) {
  return value instanceof Date && Number.isFinite(value.getTime())
}

/**
 * @param {StripeSubscriptionLike} subscription
 * @returns {StripeSubscriptionItemLike | null}
 */
function firstItem(subscription) {
  const items = subscription?.items?.data
  return Array.isArray(items) && items.length > 0 ? items[0] ?? null : null
}

/**
 * Ordnet den Preis des ersten Subscription-Items einer Research-Stufe zu.
 *
 * 1. Konfigurierte Price-ID (Env-Vars aus config.mjs).
 * 2. Fallback für rotierte Preise: Der Preis trägt gültige Metadaten
 *    research_tier/research_interval UND gehört zum Stripe-Produkt genau dieser
 *    Stufe (STRIPE_RESEARCH_PRODUCT_ID_READER|MEMBER|SUPPORTER). Metadaten
 *    allein reichen nie; ein Preis an einem fremden Produkt gibt keinen Zugang.
 *
 * Unbekannte Preise liefern null — sie geben keinen Zugang.
 *
 * @param {StripeSubscriptionLike} subscription
 * @param {Record<string, string | undefined>} env
 * @returns {{ priceId: string, tier: ResearchTier, interval: ResearchInterval } | null}
 */
export function resolveResearchSubscriptionPrice(subscription, env) {
  const item = firstItem(subscription)
  const price = item?.price ?? null
  const priceId = idOf(price)
  if (!priceId) return null

  const configured = resolveResearchPrice(priceId, env)
  if (configured) return { priceId, ...configured }

  if (!price || typeof price !== 'object') return null

  const tier = price.metadata?.research_tier
  const interval = price.metadata?.research_interval
  if (!isResearchTier(tier) || !isResearchInterval(interval)) return null

  const tierProductId = getResearchTierProductId(tier, env)
  const productId = idOf(price.product)
  if (!tierProductId || !productId || productId !== tierProductId) return null

  return { priceId, tier, interval }
}

/**
 * Baut aus einer Stripe-Subscription die Cache-Zeile.
 *
 * Voraussetzung: metadata.product === 'research' und ein nicht leeres
 * metadata.userId (beides setzt createResearchCheckoutSession).
 *
 * `pastDueSince` bleibt über wiederholte past_due-Events stabil (die 72-h-Kulanz
 * läuft ab dem ERSTEN Fehlschlag), sonst beginnt sie jetzt; außerhalb von
 * past_due ist sie immer null.
 *
 * @param {StripeSubscriptionLike} subscription
 * @param {{ env: Record<string, string | undefined>, nowMs: number, existing?: ExistingResearchSubscription | null }} options
 * @returns {ResearchSubscriptionMapping}
 */
export function mapStripeSubscriptionToResearchRow(subscription, { env, nowMs, existing = null }) {
  if (typeof nowMs !== 'number' || !Number.isFinite(nowMs)) {
    throw new TypeError('mapStripeSubscriptionToResearchRow: nowMs must be a finite number')
  }
  if (!subscription || typeof subscription !== 'object' || typeof subscription.id !== 'string' || !subscription.id) {
    return { ok: false, reason: 'invalid_subscription' }
  }

  const metadata = subscription.metadata ?? {}
  if (metadata.product !== RESEARCH_PRODUCT) return { ok: false, reason: 'not_research' }

  const userId = typeof metadata.userId === 'string' ? metadata.userId.trim() : ''
  if (!userId) return { ok: false, reason: 'missing_user_id' }

  const stripeCustomerId = idOf(subscription.customer)
  if (!stripeCustomerId) return { ok: false, reason: 'missing_customer' }

  const status = typeof subscription.status === 'string' ? subscription.status.trim() : ''
  if (!status) return { ok: false, reason: 'missing_status' }

  const item = firstItem(subscription)
  const price = resolveResearchSubscriptionPrice(subscription, env)

  /** @type {Date | null} */
  let pastDueSince = null
  if (status === 'past_due') {
    const keepExisting =
      existing != null &&
      existing.stripeSubscriptionId === subscription.id &&
      existing.status === 'past_due' &&
      isValidDate(existing.pastDueSince)
    pastDueSince = keepExisting ? /** @type {Date} */ (existing.pastDueSince) : new Date(nowMs)
  }

  return {
    ok: true,
    userId,
    row: {
      stripeCustomerId,
      stripeSubscriptionId: subscription.id,
      status,
      tier: price?.tier ?? null,
      billingInterval: price?.interval ?? null,
      priceId: price?.priceId ?? idOf(item?.price),
      cancelAtPeriodEnd: subscription.cancel_at_period_end === true,
      cancelAt: unixToDate(subscription.cancel_at),
      currentPeriodEnd: unixToDate(subscription.current_period_end) ?? unixToDate(item?.current_period_end),
      pastDueSince,
      stripeCreatedAt: unixToDate(subscription.created),
    },
  }
}

/**
 * Darf `incoming` die gespeicherte Zeile des Users ersetzen?
 *
 * - Keine Zeile oder dieselbe Subscription: immer (frischer Stripe-Stand).
 * - Andere Subscription: nie, wenn die gespeicherte noch Zugang gibt und die
 *   neue nicht (z. B. ein verspätetes `deleted` einer alten Subscription).
 *   Geben beide Zugang, gewinnt die neuere (stripeCreatedAt). Sonst ersetzen.
 *
 * @param {ExistingResearchSubscription | null | undefined} existing
 * @param {ResearchSubscriptionRow} incoming
 * @param {number} nowMs
 * @returns {boolean}
 */
export function shouldReplaceResearchSubscription(existing, incoming, nowMs) {
  if (!existing) return true
  if (existing.stripeSubscriptionId === incoming.stripeSubscriptionId) return true

  const existingHasAccess = computeResearchAccess(existing, nowMs).hasAccess
  // Frisch gemappte Zeilen haben noch kein updatedAt; bei past_due ist
  // pastDueSince ohnehin gesetzt.
  const incomingHasAccess = computeResearchAccess({ ...incoming, updatedAt: new Date(nowMs) }, nowMs).hasAccess

  if (existingHasAccess && !incomingHasAccess) return false
  if (existingHasAccess && incomingHasAccess) {
    return timeOf(incoming.stripeCreatedAt) >= timeOf(existing.stripeCreatedAt)
  }
  return true
}

/**
 * Status, in denen eine Research-Subscription noch Zugang gibt oder noch Geld
 * einziehen kann (Smart Retries einer offenen Rechnung, spätes Bezahlen einer
 * `incomplete`-Rechnung). Solange eine davon existiert, startet kein zweiter
 * Checkout — sonst drohen zwei Abos und eine doppelte Abbuchung.
 */
export const RESEARCH_OPEN_SUBSCRIPTION_STATUSES = Object.freeze(['active', 'trialing', 'past_due', 'unpaid', 'incomplete'])

/**
 * Erste Research-Subscription (metadata.product === 'research') in einem
 * noch offenen Status, sonst null. Stripe listet neueste zuerst.
 *
 * @template {StripeSubscriptionLike} T
 * @param {ReadonlyArray<T> | null | undefined} subscriptions
 * @returns {T | null}
 */
export function findOpenResearchSubscription(subscriptions) {
  if (!Array.isArray(subscriptions)) return null
  for (const subscription of subscriptions) {
    if (!subscription || subscription.metadata?.product !== RESEARCH_PRODUCT) continue
    if (RESEARCH_OPEN_SUBSCRIPTION_STATUSES.includes(subscription.status)) return subscription
  }
  return null
}

/**
 * Ersatz, wenn die gespeicherte Subscription den Zugang verliert (gekündigt,
 * abgelaufen …), der User aber noch ein ANDERES laufendes Research-Abo hat —
 * z. B. nach einem Doppel-Abo, bei dem das neuere storniert wurde.
 *
 * Nur `active`/`trialing` mit bekannter Stufe und laufender Periode: bei
 * `past_due` wäre der Beginn der 72-h-Kulanz unbekannt (sie würde sonst neu
 * starten). Bei mehreren gewinnt die neueste (wie shouldReplaceResearchSubscription).
 *
 * @template {StripeSubscriptionLike} T
 * @param {ReadonlyArray<T> | null | undefined} subscriptions
 * @param {{ env: Record<string, string | undefined>, nowMs: number, userId: string, excludeSubscriptionId?: string | null }} options
 * @returns {T | null}
 */
export function pickResearchFallbackSubscription(subscriptions, { env, nowMs, userId, excludeSubscriptionId = null }) {
  if (!Array.isArray(subscriptions) || typeof userId !== 'string' || !userId) return null

  /** @type {T | null} */
  let best = null
  let bestCreated = -1
  for (const subscription of subscriptions) {
    if (!subscription || subscription.id === excludeSubscriptionId) continue
    if (subscription.status !== 'active' && subscription.status !== 'trialing') continue

    const mapped = mapStripeSubscriptionToResearchRow(subscription, { env, nowMs })
    if (!mapped.ok || mapped.userId !== userId) continue
    if (!computeResearchAccess({ ...mapped.row, updatedAt: new Date(nowMs) }, nowMs).hasAccess) continue

    const created = timeOf(mapped.row.stripeCreatedAt)
    if (best === null || created > bestCreated) {
      best = subscription
      bestCreated = created
    }
  }
  return best
}
