import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { after } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { WelcomeView } from '@/components/checkout/welcome-view'
import { resolveWelcome } from '@/lib/checkout-welcome'
import { CHECKOUT_NONCE_COOKIE } from '@/lib/checkout-guest.mjs'

// Rücksprung aus Stripe nach dem Gast-Checkout (success_url). Öffentlich: Käufer haben hier oft noch
// kein Konto. Schaltet frei (idempotent) und meldet nur ein gerade neu angelegtes Konto im selben
// Browser automatisch an. Funktioniert auch bei ausgeschaltetem CHECKOUT_GUEST_ENABLED, damit bereits
// begonnene Käufe abgeschlossen werden.

export const dynamic = 'force-dynamic'
// Freischaltung (Kontoanlage, Stripe) vor der Antwort, danach per after() Vertragsbestätigung (Mail-
// Timeout 8 s) und Doppel-Abo-Prüfung. after() läuft nur innerhalb der Funktionslaufzeit.
export const maxDuration = 60

export const metadata: Metadata = {
  title: 'Willkommen',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
}

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

export default async function WillkommenPage({ searchParams }: PageProps) {
  const [params, cookieStore, { userId }] = await Promise.all([searchParams ?? Promise.resolve({}), cookies(), auth()])
  const raw = (params as Record<string, string | string[] | undefined>).session_id
  const sessionId = Array.isArray(raw) ? raw[0] : raw

  const state = await resolveWelcome({
    sessionId,
    cookieNonce: cookieStore.get(CHECKOUT_NONCE_COOKIE)?.value,
    signedInUserId: userId ?? null,
    defer: (task) => after(task),
  })

  return <WelcomeView state={state} />
}
