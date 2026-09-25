// Gast-Checkout "erst zahlen, Konto automatisch" (Go-live-Plan Abschnitt 3, Variante A).
// Reine Funktionen ohne Netz-, DB- oder Node-Abhängigkeiten, damit Route, Seiten und Tests dieselben
// Regeln nutzen. Angeschlossen wird in app/api/checkout/start, lib/checkout-fulfillment.ts und
// app/willkommen.
//
// Schalter: CHECKOUT_GUEST_ENABLED (Standard aus). Aus heißt: alter Weg über Konto und Dashboard,
// /checkout und /api/checkout/start leiten dorthin weiter. Bereits begonnene Gast-Käufe werden
// trotzdem weiter freigeschaltet (Webhook und /willkommen hängen nicht am Schalter).
//
// ANWALTLICH PRÜFEN: Zustimmung zum Sofortstart (Pflicht vor der Weiterleitung), Bestellbutton und
// Pflichtangaben in Stripe. Details in lib/legal-texts.ts.

import { findCheckoutBlockingSubscription } from './checkout-eligibility.mjs'

export const CHECKOUT_PRODUCT = 'mentorship'
/** @type {readonly ['guest', 'account']} */
export const CHECKOUT_FLOWS = Object.freeze(/** @type {const} */ (['guest', 'account']))
/** Produkte mit eigenem Kaufweg. Deren Checkout-Sessions fasst die Mentorship-Freischaltung nie an. */
export const FOREIGN_PRODUCTS = Object.freeze(['raidmap', 'research'])

export const CHECKOUT_NONCE_COOKIE = 'pat_co'
export const CHECKOUT_NONCE_MAX_AGE_SECONDS = 2 * 60 * 60
/** Automatische Anmeldung nur, wenn die Checkout-Session höchstens so alt ist. */
export const AUTO_SIGN_IN_WINDOW_MS = 60 * 60 * 1000
/** Laufzeit des Einmal-Tickets für die automatische Anmeldung auf /willkommen. */
export const SIGN_IN_TICKET_SECONDS = 10 * 60
/** Laufzeit des Login-Links in der Bestätigungsmail (nur für neu angelegte Konten). */
export const LOGIN_LINK_SECONDS = 7 * 24 * 60 * 60

// Stripe akzeptiert im Abo-Modus mit der gepinnten API-Version 2024-10-28.acacia nur diese Werte für
// submit_type. Im Testmodus am 25.09.2026 geprüft: 'pay' wird abgelehnt ("You can not pass
// `submit_type: 'pay'` in `subscription` mode"), 'auto' und 'subscribe' gehen.
export const SUBSCRIPTION_MODE_SUBMIT_TYPES = Object.freeze(['auto', 'subscribe'])
const KNOWN_SUBMIT_TYPES = new Set(['auto', 'book', 'donate', 'pay', 'subscribe'])
export const DEFAULT_SUBMIT_TYPE = 'pay'

const SOURCE_PATTERN = /^[a-z0-9][a-z0-9_-]{0,39}$/
const CHECKOUT_SESSION_ID = /^cs_(?:test|live)_[A-Za-z0-9]{10,200}$/

// ---------------------------------------------------------------------------
// Eingaben
// ---------------------------------------------------------------------------

/**
 * Schalter aus der Umgebung. Nur ausdrückliche Ja-Werte schalten ein, alles andere bleibt aus.
 * @param {string | null | undefined} value
 */
export function parseEnvFlag(value) {
  if (typeof value !== 'string') return false
  return ['1', 'true', 'yes', 'on', 'ja'].includes(value.trim().toLowerCase())
}

/**
 * Herkunft des Klicks (z. B. hero_cta). Nur kurze, harmlose Kennungen, sonst 'direct'.
 * @param {unknown} value
 */
export function sanitizeSource(value) {
  const raw = typeof value === 'string' ? value.trim().toLowerCase() : ''
  return SOURCE_PATTERN.test(raw) ? raw : 'direct'
}

/**
 * Formular von /checkout. Ohne gesetzte Zustimmung zum Sofortstart startet kein Checkout.
 * @param {Record<string, unknown> | null | undefined} fields
 * @returns {{ ok: true, src: string } | { ok: false, error: 'consent_required', src: string }}
 */
export function parseStartForm(fields) {
  const src = sanitizeSource(fields?.src)
  const consent = fields?.consent_early_start
  const accepted = typeof consent === 'string' && ['1', 'on', 'true', 'yes'].includes(consent.trim().toLowerCase())
  return accepted ? { ok: true, src } : { ok: false, error: 'consent_required', src }
}

/** @param {unknown} value */
export function isCheckoutSessionId(value) {
  return typeof value === 'string' && CHECKOUT_SESSION_ID.test(value)
}

/** @param {unknown} value */
export function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

/**
 * E-Mail für die Anzeige kürzen: "max@example.com" wird "m••@example.com".
 * @param {string | null | undefined} email
 */
export function maskEmail(email) {
  const value = normalizeEmail(email)
  const at = value.lastIndexOf('@')
  if (at < 1) return ''
  const local = value.slice(0, at)
  return `${local[0]}${'•'.repeat(Math.min(Math.max(local.length - 1, 2), 6))}${value.slice(at)}`
}

// ---------------------------------------------------------------------------
// Stripe-Session
// ---------------------------------------------------------------------------

/**
 * Bestellbutton-Typ aus CHECKOUT_SUBMIT_TYPE. Standard ist 'pay'. Werte, die Stripe im Abo-Modus
 * nicht annimmt, werden weggelassen (Stripe beschriftet den Button dann selbst).
 * @param {string | null | undefined} raw
 * @returns {{ submitType: 'auto' | 'subscribe' | null, requested: string, reason: 'ok' | 'disabled' | 'unsupported_in_subscription_mode' | 'invalid' }}
 */
export function resolveSubmitType(raw) {
  const requested = typeof raw === 'string' && raw.trim() ? raw.trim().toLowerCase() : DEFAULT_SUBMIT_TYPE
  if (['none', 'off', 'false', '0'].includes(requested)) return { submitType: null, requested, reason: 'disabled' }
  if (!KNOWN_SUBMIT_TYPES.has(requested)) return { submitType: null, requested, reason: 'invalid' }
  if (!SUBSCRIPTION_MODE_SUBMIT_TYPES.includes(requested)) {
    return { submitType: null, requested, reason: 'unsupported_in_subscription_mode' }
  }
  return { submitType: /** @type {'auto' | 'subscribe'} */ (requested), requested, reason: 'ok' }
}

/**
 * @typedef {{
 *   origin: string,
 *   priceId: string,
 *   flow: 'guest' | 'account',
 *   src: string,
 *   consentAt: string,
 *   termsVersion: string,
 *   nonceHash: string,
 *   submitMessage: string,
 *   termsAcceptanceMessage?: string | null,
 *   submitType?: 'auto' | 'subscribe' | null,
 *   tosConsent?: boolean,
 *   customFields?: unknown[],
 *   customerId?: string | null,
 *   customerEmail?: string | null,
 *   userId?: string | null,
 *   paymentMethodConfiguration?: string | null,
 * }} CheckoutParamsInput
 */

/**
 * Parameter für stripe.checkout.sessions.create. Bewusst ohne payment_method_types, damit die
 * dynamischen Zahlungsarten aus dem Stripe-Dashboard greifen.
 * @param {CheckoutParamsInput} input
 */
export function buildCheckoutSessionParams(input) {
  if (!input.priceId) throw new Error('Missing price id')
  if (!input.origin) throw new Error('Missing origin')
  if (!CHECKOUT_FLOWS.includes(input.flow)) throw new Error(`Unknown checkout flow: ${input.flow}`)
  if (input.flow === 'account' && (!input.customerId || !input.userId)) {
    throw new Error('Account checkout needs customer and user')
  }
  if (!input.consentAt || !input.termsVersion || !input.nonceHash) throw new Error('Missing consent or nonce data')

  const origin = input.origin.replace(/\/+$/, '')
  const src = sanitizeSource(input.src)

  /** @type {Record<string, string>} */
  const metadata = {
    product: CHECKOUT_PRODUCT,
    flow: input.flow,
    src,
    consent_early_start: 'true',
    consent_at: input.consentAt,
    terms_version: input.termsVersion,
    nonce_hash: input.nonceHash,
    ...(input.userId ? { userId: input.userId } : {}),
  }

  /** @type {Record<string, unknown>} */
  const params = {
    mode: 'subscription',
    locale: 'de',
    line_items: [{ price: input.priceId, quantity: 1 }],
    allow_promotion_codes: true,
    billing_address_collection: 'auto',
    automatic_tax: { enabled: true },
    custom_text: {
      submit: { message: input.submitMessage },
      ...(input.tosConsent && input.termsAcceptanceMessage
        ? { terms_of_service_acceptance: { message: input.termsAcceptanceMessage } }
        : {}),
    },
    ...(input.tosConsent ? { consent_collection: { terms_of_service: 'required' } } : {}),
    ...(input.submitType ? { submit_type: input.submitType } : {}),
    ...(input.customFields && input.customFields.length > 0 ? { custom_fields: input.customFields } : {}),
    ...(input.paymentMethodConfiguration ? { payment_method_configuration: input.paymentMethodConfiguration } : {}),
    metadata,
    subscription_data: { metadata: { ...metadata, signupType: 'launch_2026' } },
    success_url: `${origin}/willkommen?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/checkout?abgebrochen=1${src === 'direct' ? '' : `&src=${encodeURIComponent(src)}`}`,
  }

  if (input.customerId) {
    params.customer = input.customerId
    // Automatische Steuer braucht die Adresse am Customer.
    params.customer_update = { address: 'auto', name: 'auto' }
  } else if (input.customerEmail) {
    params.customer_email = input.customerEmail
  }

  return params
}

/**
 * Metadaten einer Checkout-Session dieses Kaufwegs.
 * @param {{ metadata?: Record<string, string> | null } | null | undefined} session
 */
export function readCheckoutMetadata(session) {
  const metadata = session?.metadata ?? {}
  const flow = CHECKOUT_FLOWS.includes(/** @type {any} */ (metadata.flow)) ? /** @type {'guest' | 'account'} */ (metadata.flow) : null
  return {
    product: metadata.product ?? null,
    flow,
    src: sanitizeSource(metadata.src),
    consentEarlyStart: metadata.consent_early_start === 'true',
    consentAt: metadata.consent_at ?? null,
    termsVersion: metadata.terms_version ?? null,
    nonceHash: metadata.nonce_hash ?? null,
    userId: metadata.userId ?? null,
  }
}

/**
 * Darf die Freischaltung diese Session bearbeiten? Nur Mentorship-Sessions aus /api/checkout/start,
 * im Abo-Modus und abgeschlossen. Raid Map, Research und der alte Kontoweg bleiben unberührt.
 * @param {{ status?: string | null, mode?: string | null, metadata?: Record<string, string> | null } | null | undefined} session
 * @returns {{ ok: true, flow: 'guest' | 'account' } | { ok: false, reason: 'foreign_product' | 'not_this_flow' | 'not_subscription' | 'not_complete' }}
 */
export function checkFulfillable(session) {
  const meta = readCheckoutMetadata(session)
  if (meta.product && FOREIGN_PRODUCTS.includes(meta.product)) return { ok: false, reason: 'foreign_product' }
  if (meta.product !== CHECKOUT_PRODUCT || !meta.flow) return { ok: false, reason: 'not_this_flow' }
  if (session?.mode !== 'subscription') return { ok: false, reason: 'not_subscription' }
  if (session?.status !== 'complete') return { ok: false, reason: 'not_complete' }
  return { ok: true, flow: meta.flow }
}

// ---------------------------------------------------------------------------
// Konto
// ---------------------------------------------------------------------------

/**
 * @typedef {{ id: string, verified: boolean, isAdmin: boolean }} AccountMatch
 * @typedef {{ action: 'create' } | { action: 'link', userId: string, reason: 'account-flow' | 'existing-email' | 'existing-admin', notifyAdmin: boolean }} AccountDecision
 */

/**
 * Welches Clerk-Konto bekommt das Abo?
 * - Angemeldeter Kauf (flow 'account'): das Konto, das den Checkout gestartet hat.
 * - Gast: ein Konto, bei dem genau diese E-Mail bestätigt ist, sonst ein neues Konto.
 * - Admin-Konto: wird verknüpft, aber Petar bekommt eine Meldung.
 * Bestehende Konten werden nie automatisch angemeldet (siehe decideAutoSignIn), sonst könnte man mit
 * einer fremden E-Mail-Adresse ein fremdes Konto übernehmen.
 * @param {{ flow: 'guest' | 'account', accountUser?: { id: string, isAdmin: boolean } | null, matches?: AccountMatch[] }} input
 * @returns {AccountDecision}
 */
export function decideAccount({ flow, accountUser = null, matches = [] }) {
  if (flow === 'account' && accountUser?.id) {
    return { action: 'link', userId: accountUser.id, reason: 'account-flow', notifyAdmin: false }
  }
  const verified = matches.filter((match) => match.verified)
  if (verified.length > 0) {
    const admin = verified.find((match) => match.isAdmin)
    const picked = admin ?? verified[0]
    return {
      action: 'link',
      userId: picked.id,
      reason: picked.isAdmin ? 'existing-admin' : 'existing-email',
      notifyAdmin: picked.isAdmin,
    }
  }
  return { action: 'create' }
}

/**
 * Automatische Anmeldung auf /willkommen per Einmal-Ticket. Nur für ein gerade neu angelegtes Konto,
 * im selben Browser (Nonce-Cookie aus /api/checkout/start), kurz nach dem Kauf und genau einmal.
 * @param {{
 *   userId: string | null,
 *   createdNewUser: boolean,
 *   nonceMatches: boolean,
 *   sessionCreatedAt: number,
 *   ticketIssuedAt: Date | string | null,
 *   signedInUserId?: string | null,
 *   now?: number,
 * }} input sessionCreatedAt in Millisekunden
 * @returns {{ allowed: true } | { allowed: false, reason: 'no-account' | 'already-signed-in' | 'other-account-signed-in' | 'existing-account' | 'nonce-mismatch' | 'too-old' | 'ticket-already-issued' }}
 */
export function decideAutoSignIn({
  userId,
  createdNewUser,
  nonceMatches,
  sessionCreatedAt,
  ticketIssuedAt,
  signedInUserId = null,
  now = Date.now(),
}) {
  if (!userId) return { allowed: false, reason: 'no-account' }
  if (signedInUserId && signedInUserId === userId) return { allowed: false, reason: 'already-signed-in' }
  if (signedInUserId) return { allowed: false, reason: 'other-account-signed-in' }
  if (!createdNewUser) return { allowed: false, reason: 'existing-account' }
  if (!nonceMatches) return { allowed: false, reason: 'nonce-mismatch' }
  if (!isWithinWindow(sessionCreatedAt, now)) return { allowed: false, reason: 'too-old' }
  if (ticketIssuedAt) return { allowed: false, reason: 'ticket-already-issued' }
  return { allowed: true }
}

/**
 * Liegt der Zeitpunkt höchstens AUTO_SIGN_IN_WINDOW_MS zurück (und nicht in der Zukunft, mit einer
 * Minute Spielraum für Uhrenabweichung)?
 * @param {number} createdAtMs
 * @param {number} [now]
 */
export function isWithinWindow(createdAtMs, now = Date.now()) {
  if (!Number.isFinite(createdAtMs)) return false
  const age = now - createdAtMs
  return age >= -60_000 && age <= AUTO_SIGN_IN_WINDOW_MS
}

// ---------------------------------------------------------------------------
// Doppel-Abo
// ---------------------------------------------------------------------------

/**
 * Läuft neben dem gerade gekauften Abo noch ein anderes Mentorship-Abo, das Stripe weiter abrechnet?
 * @param {{
 *   subscriptions: Array<{ id: string, status: string, product?: string | null, priceIds?: string[] }>,
 *   newSubscriptionId: string,
 *   mentorshipPriceIds: string[],
 *   paypalActive?: boolean,
 * }} input
 * @returns {{ duplicate: false } | { duplicate: true, kind: 'stripe', subscriptionId: string, status: string } | { duplicate: true, kind: 'paypal' }}
 */
export function findDuplicateSubscription({ subscriptions, newSubscriptionId, mentorshipPriceIds, paypalActive = false }) {
  const others = (subscriptions ?? [])
    .filter((subscription) => subscription.id !== newSubscriptionId)
    .filter((subscription) => !subscription.product || !FOREIGN_PRODUCTS.includes(subscription.product))
    .filter(
      (subscription) =>
        mentorshipPriceIds.length === 0 || (subscription.priceIds ?? []).some((id) => mentorshipPriceIds.includes(id))
    )
  const blocking = findCheckoutBlockingSubscription(others)
  if (blocking) return { duplicate: true, kind: 'stripe', subscriptionId: blocking.id, status: blocking.status }
  if (paypalActive) return { duplicate: true, kind: 'paypal' }
  return { duplicate: false }
}
