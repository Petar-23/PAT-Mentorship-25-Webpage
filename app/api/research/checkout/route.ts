// Checkout für PAT Research (research.price-action-trader.de).
// Reihenfolge der Prüfungen ist Teil des Vertrags (siehe lib/research/api-routes.test.mjs):
// Host (Kill-Switch) → Origin → Login → Body/Einwilligungen inkl. Textversionen
// → Rate-Limit → E-Mail → bestehendes Abo
// (Cache) → Einwilligungen protokollieren → Stripe-Checkout (prüft in Stripe
// erneut auf offene Abos und schließt ältere offene Sessions, siehe
// createResearchCheckoutSession).
import { auth, currentUser } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getEmailFromSessionClaims } from '@/lib/clerk-claims'
import { getResearchAccessState } from '@/lib/research/access'
import { RESEARCH_CONSENT_VERSIONS, isResearchInterval, isResearchTier } from '@/lib/research/config.mjs'
import { recordCheckoutConsents, recordResearchConsent } from '@/lib/research/consent'
import { consumeResearchRateLimit } from '@/lib/research/rate-limit'
import {
  isResearchServedForRequest,
  researchBasePathFromRequest,
  researchOriginFromRequest,
} from '@/lib/research/request-context'
import { isSameOriginRequest, jsonError } from '@/lib/research/request-guards'
import {
  createResearchCheckoutSession,
  describeResearchErrorForLog,
  isResearchStripeError,
} from '@/lib/research/stripe'
import { isResearchTestMode } from '@/lib/research/test-mode'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_BODY_BYTES = 4096
const CHECKOUT_RATE_LIMIT = { windowMs: 60 * 60 * 1000, maxAttempts: 10 }
const CONSENT_FIELDS = new Set<PropertyKey>(['acceptTerms', 'waiveWithdrawal'])
const CONSENT_VERSION_FIELDS = new Set<PropertyKey>(['termsVersion', 'withdrawalWaiverVersion'])

// Einwilligungen müssen literal `true` sein (nicht "true", nicht 1). Die
// Textversionen müssen die aktuellen sein: Der Client schickt die Versionen der
// Texte, die er gerendert hat; eine vor einem Text-Update geladene Seite
// bekommt 409. Verglichen werden nur Versionen, nicht der Wortlaut: Dass jede
// Textänderung eine neue Version bekommt, erzwingt der Ledger-Test in
// lib/research/ui.test.mjs.
const checkoutBodySchema = z.object({
  tier: z.string().refine(isResearchTier),
  interval: z.string().refine(isResearchInterval),
  acceptTerms: z.literal(true),
  waiveWithdrawal: z.literal(true),
  termsVersion: z.literal(RESEARCH_CONSENT_VERSIONS.terms),
  withdrawalWaiverVersion: z.literal(RESEARCH_CONSENT_VERSIONS.withdrawalWaiver),
})

async function readJsonBody(request: Request): Promise<unknown> {
  const text = await request.text()
  if (text.length > MAX_BODY_BYTES) throw new Error('Body too large')
  return JSON.parse(text)
}

async function resolvePrimaryEmail(sessionClaims: unknown): Promise<string | null> {
  const fromClaims = getEmailFromSessionClaims(sessionClaims)
  if (fromClaims) return fromClaims

  const user = await currentUser()
  if (!user) return null
  return (
    user.primaryEmailAddress?.emailAddress ??
    user.emailAddresses.find((email) => email.id === user.primaryEmailAddressId)?.emailAddress ??
    null
  )
}

export async function POST(request: Request) {
  // Zweite Linie hinter der Middleware: Production nur auf dem Research-Host,
  // Kill-Switch (kein RESEARCH_PUBLIC_HOST) nirgends.
  if (!isResearchServedForRequest(request)) {
    return jsonError(404, 'not_found', 'Not found.')
  }

  if (!isSameOriginRequest(request)) {
    return jsonError(403, 'bad_origin', 'This request is not allowed from this origin.')
  }

  try {
    const { userId, sessionClaims } = await auth()
    if (!userId) {
      return jsonError(401, 'signed_out', 'Please sign in to subscribe.')
    }

    let body: unknown
    try {
      body = await readJsonBody(request)
    } catch {
      return jsonError(400, 'invalid_request', 'Invalid request.')
    }

    const parsed = checkoutBodySchema.safeParse(body)
    if (!parsed.success) {
      const fields = parsed.error.issues.map((issue) => issue.path[0])
      const onlyConsentIssues = fields.every(
        (field) => field !== undefined && (CONSENT_FIELDS.has(field) || CONSENT_VERSION_FIELDS.has(field))
      )
      if (!onlyConsentIssues) return jsonError(400, 'invalid_request', 'Invalid request.')
      // Veraltete oder fehlende Version (Seite vor einem Text-Update geladen):
      // nichts protokollieren, der Client lädt neu und fragt erneut.
      if (fields.some((field) => CONSENT_VERSION_FIELDS.has(field))) {
        return jsonError(
          409,
          'consent_outdated',
          'The Terms of Service or the withdrawal notice have been updated. Please reload the page and confirm again.'
        )
      }
      return jsonError(400, 'consent_required', 'Please accept the Terms of Service and the withdrawal notice to continue.')
    }
    const { tier, interval } = parsed.data

    const limit = await consumeResearchRateLimit({ key: `checkout:${userId}`, ...CHECKOUT_RATE_LIMIT })
    if (limit.limited) {
      return jsonError(429, 'rate_limited', 'Too many checkout attempts. Please try again later.', {
        headers: { 'Retry-After': String(limit.retryAfterSeconds) },
      })
    }

    const basePath = researchBasePathFromRequest(request)

    // Dev-only Test-Mode: gleiche Prüfungen, aber kein Stripe und keine
    // Einwilligungs-Einträge (doppelt geguarded in lib/research/test-mode.ts).
    if (isResearchTestMode()) {
      const access = await getResearchAccessState(userId)
      if (access.hasAccess) {
        return jsonError(409, 'already_subscribed', 'You already have an active PAT Research membership.')
      }
      return NextResponse.json({ url: `${basePath}/welcome?test=1` })
    }

    const email = await resolvePrimaryEmail(sessionClaims)
    if (!email) {
      return jsonError(400, 'no_email', 'Your account has no email address. Please add one and try again.')
    }

    const access = await getResearchAccessState(userId)
    if (access.hasAccess) {
      return jsonError(409, 'already_subscribed', 'You already have an active PAT Research membership.')
    }

    const consentReference = crypto.randomUUID()
    await recordCheckoutConsents({ userId, reference: consentReference, tier, interval })

    const origin = researchOriginFromRequest(request)
    const { url, sessionId } = await createResearchCheckoutSession({
      userId,
      email,
      tier,
      interval,
      consentReference,
      successUrl: `${origin}${basePath}/welcome?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${origin}${basePath}/pricing?checkout=cancelled`,
    })

    // Verknüpfung Einwilligung ↔ Session. Die Referenz steht zusätzlich in den
    // Session-Metadaten, deshalb blockiert ein Fehler hier den Kauf nicht.
    try {
      await recordResearchConsent({
        userId,
        kind: 'checkout_session_created',
        reference: consentReference,
        metadata: { sessionId, tier, interval },
      })
    } catch (error) {
      console.error('[research] checkout_session_created not recorded (non-fatal)', describeResearchErrorForLog(error))
    }

    return NextResponse.json({ url })
  } catch (error) {
    // Stripe kennt ein laufendes oder noch offenes Abo, das der Cache (noch)
    // nicht als Zugang zählt — z. B. past_due nach Ablauf der Kulanz. Kein
    // zweites Abo: der User klärt das bestehende im Account/Portal.
    if (isResearchStripeError(error, 'already_subscribed')) {
      return jsonError(
        409,
        'already_subscribed',
        error.subscriptionStatus === 'active' || error.subscriptionStatus === 'trialing'
          ? 'You already have an active PAT Research membership.'
          : 'Your existing PAT Research subscription has an open payment. Please update your payment method in your account instead of subscribing again.'
      )
    }
    console.error('[research] checkout failed', describeResearchErrorForLog(error))
    return jsonError(500, 'checkout_failed', 'Checkout could not be started. Please try again.')
  }
}
