import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { findBlockingMentorshipSubscription, getOrCreateMentorshipCustomer, stripe } from '@/lib/stripe'
import { hasRunningMembership, resolveSignedInEmail } from '@/lib/checkout-access'
import { isGuestCheckoutEnabled, isStripeTosConsentEnabled, legacyEntryPath } from '@/lib/checkout-mode'
import { mentorshipSourceCustomFields } from '@/lib/pat-source'
import { CHECKOUT_TERMS_VERSION, checkoutSubmitMessage, checkoutTermsAcceptanceMessage } from '@/lib/legal-texts'
import {
  CHECKOUT_NONCE_COOKIE,
  CHECKOUT_NONCE_MAX_AGE_SECONDS,
  buildCheckoutSessionParams,
  parseStartForm,
  resolveSubmitType,
} from '@/lib/checkout-guest.mjs'
import { createCheckoutNonce, hashCheckoutNonce } from '@/lib/checkout-nonce.mjs'
import { createRateLimiter } from '@/lib/vertrag-erklaerung.mjs'
import { getClientIp, isSameOriginRequest } from '@/lib/vertrag-request'

// Start des Gast-Checkouts (Formular von /checkout, Antwort 303 zu Stripe). Für Gäste und Angemeldete.
// Die Zustimmung zum sofortigen Leistungsbeginn wird hier serverseitig erzwungen und mit Zeitpunkt und
// Fassung in die Metadaten von Session und Abo geschrieben (Nachweis).
// ANWALTLICH PRÜFEN: Pflicht-Zustimmung vor dem Kauf, Bestellbutton und Pflichtangaben in Stripe.

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Schutz gegen Serien (je Serverless-Instanz). Echte Käufer starten selten mehr als ein paar Sessions.
const limiter = createRateLimiter({ windowMs: 10 * 60 * 1000, max: 20 })
let submitTypeWarned = false

// Relative Weiterleitung: unabhängig davon, welchen Host request.url hinter einem Proxy trägt.
function seeOther(location: string) {
  return new NextResponse(null, { status: 303, headers: { Location: location } })
}

// Öffentliche Herkunft der Anfrage für success_url und cancel_url. Muss der Host sein, den der Browser
// benutzt hat, sonst fehlt auf /willkommen das Nonce-Cookie.
function requestOrigin(request: Request): string {
  const url = new URL(request.url)
  const first = (value: string | null) => value?.split(',')[0]?.trim() || null
  const host = first(request.headers.get('x-forwarded-host')) ?? first(request.headers.get('host')) ?? url.host
  const proto = first(request.headers.get('x-forwarded-proto')) ?? url.protocol.replace(/:$/, '')
  if (!/^[a-z0-9.-]+(:\d+)?$/i.test(host) || !['http', 'https'].includes(proto)) return url.origin
  return `${proto}://${host}`
}

function checkoutPath(params: { fehler?: string; src?: string }) {
  const search = new URLSearchParams()
  if (params.fehler) search.set('fehler', params.fehler)
  if (params.src && params.src !== 'direct') search.set('src', params.src)
  const query = search.toString()
  return query ? `/checkout?${query}` : '/checkout'
}

function isSubmitTypeRejection(error: unknown) {
  const message = error && typeof error === 'object' ? String((error as { message?: unknown }).message ?? '') : ''
  return message.includes('submit_type')
}

async function createSession(params: Stripe.Checkout.SessionCreateParams) {
  try {
    return await stripe.checkout.sessions.create(params)
  } catch (error) {
    // Fallback: Nimmt Stripe den Bestellbutton-Typ nicht an, ohne submit_type erneut versuchen.
    if (!params.submit_type || !isSubmitTypeRejection(error)) throw error
    console.warn('[checkout] Stripe rejected submit_type, retrying without it:', params.submit_type)
    const { submit_type: _omitted, ...rest } = params
    void _omitted
    return stripe.checkout.sessions.create(rest)
  }
}

export async function GET() {
  // Kein Session-Start per GET (Prefetch, Crawler): zur Seite mit dem Formular.
  return seeOther('/checkout')
}

export async function POST(request: Request) {
  const { userId, sessionClaims } = await auth()

  if (!isGuestCheckoutEnabled()) return seeOther(legacyEntryPath(Boolean(userId)))

  const form = await request.formData().catch(() => null)
  const fields: Record<string, string> = {}
  form?.forEach((value, key) => {
    if (typeof value === 'string') fields[key] = value
  })
  const parsed = parseStartForm(fields)

  if (!isSameOriginRequest(request)) return seeOther(checkoutPath({ fehler: 'sitzung', src: parsed.src }))
  if (!parsed.ok) return seeOther(checkoutPath({ fehler: 'zustimmung', src: parsed.src }))
  if (limiter.consume(getClientIp(request)).limited) {
    return seeOther(checkoutPath({ fehler: 'zu-viele', src: parsed.src }))
  }

  try {
    let flow: 'guest' | 'account' = 'guest'
    let customerId: string | null = null
    let accountUserId: string | null = null

    if (userId) {
      const email = await resolveSignedInEmail(sessionClaims)
      if (email) {
        // Doppelkauf-Schutz: Wer Zugang oder ein offenes Abo hat, geht ins Dashboard.
        if (await hasRunningMembership(userId, email)) return seeOther('/dashboard')
        if (await findBlockingMentorshipSubscription(userId)) return seeOther('/dashboard')
        const customer = await getOrCreateMentorshipCustomer(userId, email, 'checkoutStart')
        flow = 'account'
        customerId = customer.id
        accountUserId = userId
      }
    }

    const priceId = process.env.STRIPE_PRICE_ID
    if (!priceId) throw new Error('Missing STRIPE_PRICE_ID')

    const submit = resolveSubmitType(process.env.CHECKOUT_SUBMIT_TYPE)
    if (submit.reason !== 'ok' && submit.reason !== 'disabled' && !submitTypeWarned) {
      submitTypeWarned = true
      console.warn(`[checkout] CHECKOUT_SUBMIT_TYPE "${submit.requested}" not used (${submit.reason}), Stripe labels the button itself`)
    }

    const tosConsent = isStripeTosConsentEnabled()
    const nonce = createCheckoutNonce()
    const origin = requestOrigin(request)
    const params = buildCheckoutSessionParams({
      origin,
      priceId,
      flow,
      src: parsed.src,
      consentAt: new Date().toISOString(),
      termsVersion: CHECKOUT_TERMS_VERSION,
      nonceHash: hashCheckoutNonce(nonce),
      submitMessage: checkoutSubmitMessage(),
      termsAcceptanceMessage: tosConsent ? checkoutTermsAcceptanceMessage() : null,
      submitType: submit.submitType,
      tosConsent,
      customFields: mentorshipSourceCustomFields({ optional: true }),
      customerId,
      userId: accountUserId,
      paymentMethodConfiguration: process.env.CHECKOUT_PAYMENT_METHOD_CONFIGURATION?.trim() || null,
    }) as unknown as Stripe.Checkout.SessionCreateParams

    const session = await createSession(params)
    if (!session.url) throw new Error('Stripe returned no checkout URL')

    const response = NextResponse.redirect(session.url, 303)
    response.cookies.set(CHECKOUT_NONCE_COOKIE, nonce, {
      httpOnly: true,
      secure: origin.startsWith('https://'),
      sameSite: 'lax',
      path: '/willkommen',
      maxAge: CHECKOUT_NONCE_MAX_AGE_SECONDS,
    })
    return response
  } catch (error) {
    console.error('[checkout] start failed:', error)
    return seeOther(checkoutPath({ fehler: 'stripe', src: parsed.src }))
  }
}
