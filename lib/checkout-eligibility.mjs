// Weiche für den Mentorship-Kauf: Wer darf (erneut) in den Checkout, wer sieht die Mitgliederansicht?
//
// Regel (Go-live-Kritik K1):
// - Checkout nur ohne Abo oder bei `canceled`, `incomplete_expired` bzw. abgelaufener bezahlter Periode.
// - `past_due` und `unpaid`: Mitgliederansicht mit Hinweis und Link ins Kundenportal. Stripe zieht die offene
//   Rechnung weiter ein, ein zweiter Checkout würde ein Doppelabo erzeugen.
// - `incomplete`: Mitgliederansicht mit Hinweis „Zahlung wird verarbeitet“ (3DS oder Bankbestätigung offen).
// - Aktiver Zugang (Stripe, PayPal-Altvertrag, Override) bleibt immer in der Mitgliederansicht.
//
// Reine Funktionen ohne Stripe-/Clerk-Abhängigkeit, damit sie per `node --test` prüfbar sind.

/** Status, bei denen das Abo endgültig vorbei ist. `none` ist der DB-Cache-Wert für „kein Abo gefunden“. */
const ENDED_STATUSES = new Set(['canceled', 'incomplete_expired', 'none'])

/** Offene Rechnung: Stripe versucht weiter einzuziehen, deshalb nie ein zweiter Checkout. */
const PAYMENT_DUE_STATUSES = new Set(['past_due', 'unpaid'])

/** Erstzahlung läuft noch (3DS, Bankbestätigung). Wird nach spätestens 23 Stunden `incomplete_expired`. */
const PAYMENT_PROCESSING_STATUSES = new Set(['incomplete'])

/**
 * @typedef {string | number | Date | null | undefined} PeriodEnd
 * @typedef {{ status: string, currentPeriodEnd?: PeriodEnd }} SubscriptionLike
 * @typedef {null | 'payment-due' | 'payment-processing'} DashboardNotice
 * @typedef {'active-access' | 'no-subscription' | 'payment-due' | 'payment-processing' | 'subscription-ended' | 'payment-expired' | 'period-ended' | 'admin-keeps-member-view' | 'subscription-running'} DashboardReason
 * @typedef {{ view: 'checkout' | 'member', notice: DashboardNotice, reason: DashboardReason }} DashboardDecision
 */

/**
 * @param {PeriodEnd} value
 * @returns {number | null} Zeitpunkt in Millisekunden oder null, wenn unbekannt bzw. ungültig.
 */
function toTimestamp(value) {
  if (value == null || value === '') return null
  const time = value instanceof Date ? value.getTime() : typeof value === 'number' ? value : new Date(value).getTime()
  return Number.isFinite(time) ? time : null
}

/**
 * Ist die bezahlte Periode vorbei? Ohne Enddatum gilt sie als laufend, wie in `isInPeriodEnd` (lib/stripe.ts).
 * @param {PeriodEnd} currentPeriodEnd
 * @param {number | Date} [now]
 */
export function hasPeriodEnded(currentPeriodEnd, now = Date.now()) {
  const end = toTimestamp(currentPeriodEnd)
  if (end === null) return false
  const nowMs = now instanceof Date ? now.getTime() : now
  return end <= nowMs
}

/**
 * Darf trotz dieses Abos ein neuer Mentorship-Checkout starten?
 * @param {SubscriptionLike} subscription
 * @param {number | Date} [now]
 */
export function subscriptionAllowsNewCheckout(subscription, now = Date.now()) {
  const status = String(subscription?.status ?? '')
  if (ENDED_STATUSES.has(status)) return true
  if (PAYMENT_DUE_STATUSES.has(status) || PAYMENT_PROCESSING_STATUSES.has(status)) return false
  return hasPeriodEnded(subscription?.currentPeriodEnd, now)
}

/**
 * Stripe-Status, bei denen Stripe weiter abrechnet, einzieht oder die Erstzahlung abwartet.
 * Für frische Stripe-Daten gilt: Solange Stripe das Abo so führt, wird es weiter berechnet,
 * egal was ein (evtl. veralteter) Periodenstand sagt. Ein zweiter Checkout wäre ein Doppelabo.
 */
const STRIPE_BILLING_STATUSES = new Set(['active', 'trialing', ...PAYMENT_DUE_STATUSES, ...PAYMENT_PROCESSING_STATUSES])

/**
 * Serverseitiger Doppelkauf-Schutz auf frischen Stripe-Daten: erstes Abo, das Stripe noch abrechnet
 * oder einzieht, sonst null. Anders als die Dashboard-Weiche (DB-Cache) zählt hier nur der Status.
 * @template {SubscriptionLike} T
 * @param {readonly T[]} subscriptions
 * @returns {T | null}
 */
export function findCheckoutBlockingSubscription(subscriptions) {
  for (const subscription of subscriptions ?? []) {
    if (STRIPE_BILLING_STATUSES.has(String(subscription?.status ?? ''))) return subscription
  }
  return null
}

/**
 * Entscheidet, welche Dashboard-Ansicht ein angemeldeter Nutzer bekommt.
 * @param {{
 *   hasActiveSubscription: boolean,
 *   subscriptionDetails: SubscriptionLike | null | undefined,
 *   isAdmin?: boolean,
 *   now?: number | Date,
 * }} input
 * @returns {DashboardDecision}
 */
export function decideDashboardView({ hasActiveSubscription, subscriptionDetails, isAdmin = false, now = Date.now() }) {
  // Aktiver Zugang (inkl. PayPal-Altvertrag und Override-E-Mail) bleibt unverändert.
  if (hasActiveSubscription) return { view: 'member', notice: null, reason: 'active-access' }

  if (!subscriptionDetails) return { view: 'checkout', notice: null, reason: 'no-subscription' }

  const status = String(subscriptionDetails.status ?? '')
  if (PAYMENT_DUE_STATUSES.has(status)) return { view: 'member', notice: 'payment-due', reason: 'payment-due' }
  if (PAYMENT_PROCESSING_STATUSES.has(status)) {
    return { view: 'member', notice: 'payment-processing', reason: 'payment-processing' }
  }

  if (subscriptionAllowsNewCheckout(subscriptionDetails, now)) {
    // Admins behalten ihre bisherige Ansicht; ihr Zugang hängt nicht am Abo.
    if (isAdmin) return { view: 'member', notice: null, reason: 'admin-keeps-member-view' }
    return {
      view: 'checkout',
      notice: null,
      // `incomplete_expired`: Die Erstzahlung kam nie zustande, es gab also nie eine Mitgliedschaft.
      reason:
        status === 'incomplete_expired'
          ? 'payment-expired'
          : ENDED_STATUSES.has(status)
            ? 'subscription-ended'
            : 'period-ended',
    }
  }

  // z. B. `trialing` mit geplanter Kündigung oder ein aktives Abo ohne passende Preis-ID:
  // Die Periode läuft noch, das Abo lässt sich im Kundenportal fortsetzen. Kein zweiter Checkout.
  return { view: 'member', notice: null, reason: 'subscription-running' }
}
