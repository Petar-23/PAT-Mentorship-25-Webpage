import 'server-only'

import type Stripe from 'stripe'
import { stripe } from '@/lib/stripe'
import { claimPurchaseTracking, fulfillCheckoutSession, issueSignInTicket } from '@/lib/checkout-fulfillment'
import { MENTORSHIP_OFFER } from '@/lib/legal-texts'
import {
  checkFulfillable,
  decideAutoSignIn,
  isCheckoutSessionId,
  isWithinWindow,
  maskEmail,
  normalizeEmail,
  readCheckoutMetadata,
} from '@/lib/checkout-guest.mjs'
import { nonceMatchesHash } from '@/lib/checkout-nonce.mjs'

// Logik hinter /willkommen (Rücksprung aus Stripe). Schaltet frei (idempotent, vor jeder
// Weiterleitung ins Dashboard) und entscheidet, ob ein neues Konto automatisch angemeldet wird.
// Bestehende Konten werden nie automatisch angemeldet.

export type PurchaseEvent = { transactionId: string; value: number; currency: string }

// paymentPending: Stripe meldet die Zahlung noch nicht als eingegangen (payment_status 'unpaid', z. B.
// SEPA-Lastschrift). Dann zeigt /willkommen nicht „Zahlung erhalten“.
export type WelcomeState =
  | { kind: 'invalid' }
  | { kind: 'error' }
  | { kind: 'not-complete' }
  | { kind: 'pending' }
  | { kind: 'ticket'; ticket: string; purchase: PurchaseEvent | null; paymentPending: boolean }
  | { kind: 'redirect'; purchase: PurchaseEvent | null; paymentPending: boolean }
  | {
      kind: 'mail'
      reason: 'new-account' | 'existing-account' | 'other-account-signed-in' | 'too-old'
      emailMasked: string
      purchase: PurchaseEvent | null
      paymentPending: boolean
    }

function purchaseOf(session: Stripe.Checkout.Session): PurchaseEvent {
  const cents = typeof session.amount_total === 'number' ? session.amount_total : MENTORSHIP_OFFER.priceCents
  return {
    transactionId: session.id,
    value: cents / 100,
    currency: (session.currency ?? MENTORSHIP_OFFER.currency).toUpperCase(),
  }
}

export async function resolveWelcome(input: {
  sessionId: string | undefined
  cookieNonce: string | undefined
  signedInUserId: string | null
  defer: (task: () => Promise<unknown>) => void
}): Promise<WelcomeState> {
  if (!isCheckoutSessionId(input.sessionId)) return { kind: 'invalid' }
  const sessionId = input.sessionId as string

  let session: Stripe.Checkout.Session
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId)
  } catch (error) {
    // Meist ein unbekannter oder abgelaufener Link (resource_missing), kein Fehler der App.
    console.warn('[willkommen] session lookup failed:', error instanceof Error ? error.message : error)
    return { kind: 'invalid' }
  }

  const check = checkFulfillable(session)
  if (!check.ok) return check.reason === 'not_complete' ? { kind: 'not-complete' } : { kind: 'invalid' }

  const emailMasked = maskEmail(normalizeEmail(session.customer_details?.email ?? session.customer_email))
  const paymentPending = session.payment_status === 'unpaid'
  const createdAtMs = session.created * 1000
  // Alte Links (z. B. aus dem Verlauf) schalten nichts mehr frei und melden niemanden an.
  if (!isWithinWindow(createdAtMs)) return { kind: 'mail', reason: 'too-old', emailMasked, purchase: null, paymentPending }

  let result: Awaited<ReturnType<typeof fulfillCheckoutSession>>
  try {
    result = await fulfillCheckoutSession(sessionId, { defer: input.defer, session })
  } catch (error) {
    console.error('[willkommen] fulfillment failed:', sessionId, error)
    return { kind: 'error' }
  }
  if (result.status === 'pending') return { kind: 'pending' }
  if (result.status !== 'fulfilled') return { kind: 'invalid' }

  const record = result.record
  const purchase = (await claimPurchaseTracking(sessionId)) ? purchaseOf(session) : null
  const meta = readCheckoutMetadata(session)
  const decision = decideAutoSignIn({
    userId: record.userId,
    createdNewUser: record.createdNewUser,
    nonceMatches: nonceMatchesHash(input.cookieNonce, record.nonceHash ?? meta.nonceHash),
    sessionCreatedAt: createdAtMs,
    ticketIssuedAt: record.ticketIssuedAt,
    signedInUserId: input.signedInUserId,
  })

  if (decision.allowed) {
    const ticket = await issueSignInTicket(sessionId, record.userId as string)
    if (ticket) return { kind: 'ticket', ticket, purchase, paymentPending }
    return { kind: 'mail', reason: 'new-account', emailMasked, purchase, paymentPending }
  }

  switch (decision.reason) {
    case 'already-signed-in':
      return { kind: 'redirect', purchase, paymentPending }
    case 'other-account-signed-in':
      return { kind: 'mail', reason: 'other-account-signed-in', emailMasked, purchase, paymentPending }
    case 'existing-account':
      return { kind: 'mail', reason: 'existing-account', emailMasked, purchase, paymentPending }
    default:
      return {
        kind: 'mail',
        reason: record.createdNewUser ? 'new-account' : 'existing-account',
        emailMasked,
        purchase,
        paymentPending,
      }
  }
}
