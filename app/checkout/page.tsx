import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'
import { Card, CardContent } from '@/components/ui/card'
import { CheckoutStartForm } from '@/components/checkout/checkout-start-form'
import { hasRunningMembership, resolveSignedInEmail } from '@/lib/checkout-access'
import { isGuestCheckoutEnabled, legacyEntryPath } from '@/lib/checkout-mode'
import { sanitizeSource } from '@/lib/checkout-guest.mjs'
import { CHECKOUT_PAYMENT_METHODS, EARLY_START_CONSENT_TEXT, MENTORSHIP_OFFER, PROVIDER } from '@/lib/legal-texts'

// Kurzer Schritt vor Stripe (Gast-Checkout, Schalter CHECKOUT_GUEST_ENABLED): Preis, Laufzeit,
// Kündigung, Zahlungsarten (§ 312j Abs. 1 BGB), Links zu AGB und Widerrufsbelehrung und die nicht
// vorausgewählte Zustimmung zum sofortigen Beginn. Öffentlich, ohne Konto.
// ANWALTLICH PRÜFEN: Wortlaut dieser Seite.

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Mentorship buchen',
  description: `${MENTORSHIP_OFFER.product} buchen: ${MENTORSHIP_OFFER.price}, monatlich kündbar.`,
  alternates: { canonical: '/checkout' },
  robots: { index: false, follow: true },
}

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

const CONSENT_ERROR =
  'Bitte setze das Häkchen zum sofortigen Beginn. Ohne diese Zustimmung können wir die Buchung nicht starten.'

const FORM_ERRORS: Record<string, string> = {
  stripe: `Die Zahlung konnte gerade nicht gestartet werden. Bitte versuche es noch einmal. Klappt es wieder nicht, schreib an ${PROVIDER.email}.`,
  'zu-viele': 'Zu viele Versuche in kurzer Zeit. Bitte warte ein paar Minuten und versuche es dann erneut.',
  sitzung: 'Die Anfrage kam nicht von dieser Seite. Bitte lade die Seite neu und versuche es erneut.',
}

const PRICE_AMOUNT = `${new Intl.NumberFormat('de-DE').format(MENTORSHIP_OFFER.priceCents / 100)} €`

export default async function CheckoutPage({ searchParams }: PageProps) {
  const [{ userId, sessionClaims }, params] = await Promise.all([auth(), searchParams ?? Promise.resolve({})])

  if (!isGuestCheckoutEnabled()) redirect(legacyEntryPath(Boolean(userId)))

  // Angemeldete Mitglieder (auch mit offener Zahlung) kommen nie zu Stripe.
  if (userId) {
    const email = await resolveSignedInEmail(sessionClaims)
    if (await hasRunningMembership(userId, email)) redirect('/dashboard')
  }

  const values = params as Record<string, string | string[] | undefined>
  const src = sanitizeSource(first(values.src))
  const canceled = first(values.abgebrochen) === '1'
  const error = first(values.fehler)
  const consentError = error === 'zustimmung' ? CONSENT_ERROR : null
  const formError = error && error !== 'zustimmung' ? FORM_ERRORS[error] ?? FORM_ERRORS.stripe : null

  const facts = [
    { label: 'Leistung', value: `${MENTORSHIP_OFFER.service}.` },
    { label: 'Laufzeit', value: MENTORSHIP_OFFER.term },
    { label: 'Kündigung', value: MENTORSHIP_OFFER.cancellation },
    { label: 'Zugang', value: MENTORSHIP_OFFER.access },
    { label: 'Zahlungsarten', value: CHECKOUT_PAYMENT_METHODS.join(', ') },
  ]

  return (
    <div className="min-h-screen bg-gray-50 py-8 sm:py-12">
      <div className="container mx-auto max-w-2xl px-4">
        {canceled ? (
          <div role="status" className="mb-6 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950 sm:p-5">
            <p className="font-semibold">Zahlung abgebrochen</p>
            <p className="mt-1 text-blue-900/80">
              Es wurde nichts gebucht und nichts berechnet. Du kannst es jederzeit erneut versuchen.
            </p>
          </div>
        ) : null}

        <header className="mb-6 text-center sm:mb-8">
          <p className="text-sm font-medium text-blue-700">Buchung</p>
          <h1 className="mt-2 text-balance text-3xl font-bold text-gray-900 sm:text-4xl">{MENTORSHIP_OFFER.product}</h1>
          <p className="mx-auto mt-3 max-w-xl text-pretty text-gray-600">
            {userId
              ? 'Prüfe die Konditionen und bezahle im nächsten Schritt sicher über Stripe. Die Buchung gehört zu dem Konto, mit dem du gerade angemeldet bist.'
              : 'Prüfe die Konditionen und bezahle im nächsten Schritt sicher über Stripe. Dein Konto legen wir nach der Zahlung automatisch mit deiner E-Mail-Adresse an. Gibt es dazu schon ein Konto, ordnen wir die Buchung diesem Konto zu.'}
          </p>
        </header>

        <Card className="border-2 shadow-sm">
          <CardContent className="p-5 sm:p-8">
            <div className="text-center">
              <p className="flex items-baseline justify-center">
                <span className="text-4xl font-bold text-gray-900 sm:text-5xl">{PRICE_AMOUNT}</span>
                <span className="ml-2 text-lg text-gray-500 sm:text-xl">pro Monat</span>
              </p>
              <p className="mt-2 text-sm font-medium text-gray-600">inkl. MwSt., unbefristet, monatlich kündbar</p>
            </div>

            <dl className="mt-6 divide-y divide-gray-200 rounded-lg border border-gray-200 bg-gray-50 text-sm">
              {facts.map((fact) => (
                <div key={fact.label} className="grid gap-1 px-4 py-3 sm:grid-cols-[8.5rem_1fr] sm:gap-4">
                  <dt className="font-medium text-gray-900">{fact.label}</dt>
                  <dd className="text-gray-700">{fact.value}</dd>
                </div>
              ))}
            </dl>

            {formError ? (
              <p role="alert" className="mt-6 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                {formError}
              </p>
            ) : null}

            <div className="mt-6">
              <CheckoutStartForm src={src} consentText={EARLY_START_CONSENT_TEXT} consentError={consentError} />
            </div>

            {userId ? null : (
              <p className="mt-6 border-t border-gray-200 pt-5 text-center text-sm text-gray-600">
                Schon Mitglied?{' '}
                <Link
                  href="/sign-in?redirect_url=%2Fdashboard"
                  prefetch={false}
                  className="font-medium text-blue-700 underline underline-offset-2 hover:text-blue-900"
                >
                  Anmelden
                </Link>
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
