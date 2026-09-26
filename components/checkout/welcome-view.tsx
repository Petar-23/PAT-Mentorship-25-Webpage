'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useClerk, useSignIn } from '@clerk/nextjs'
import { CheckCircle } from '@phosphor-icons/react/CheckCircle'
import { SpinnerGap } from '@phosphor-icons/react/SpinnerGap'
import { WarningCircle } from '@phosphor-icons/react/WarningCircle'
import { trackConversion } from '@/components/analytics/tracking'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import type { PurchaseEvent, WelcomeState } from '@/lib/checkout-welcome'

// Anzeige für /willkommen. Die Entscheidungen fallen auf dem Server (lib/checkout-welcome.ts),
// hier passieren nur die Anmeldung per Einmal-Ticket, das purchase-Event und die Weiterleitung.

const CONTACT_EMAIL = 'kontakt@price-action-trader.de'
const DASHBOARD_WELCOME = '/dashboard?willkommen=1'
const SIGN_IN_HREF = `/sign-in?redirect_url=${encodeURIComponent(DASHBOARD_WELCOME)}`
const MAX_PENDING_REFRESHES = 5

// SEPA-Lastschrift und andere verzögerte Zahlungsarten: Stripe meldet die Zahlung erst später.
// Dann nicht „Zahlung erhalten“ anzeigen (lib/checkout-welcome.ts, paymentPending).
function successTitle(paymentPending: boolean) {
  return paymentPending ? 'Buchung abgeschlossen' : 'Zahlung erhalten'
}

function bookedSentence(paymentPending: boolean) {
  return paymentPending ? 'Deine Buchung ist eingegangen.' : 'Deine Mentorship ist freigeschaltet.'
}

function PaymentPendingNote({ paymentPending }: { paymentPending: boolean }) {
  if (!paymentPending) return null
  return <p>Deine Zahlung wird noch bearbeitet. Bei einer Lastschrift kann das einige Tage dauern.</p>
}

// Der Server gibt das Event nur beim ersten Aufruf je Kauf mit (purchaseTrackedAt), der Ref schützt
// zusätzlich vor doppeltem Senden innerhalb derselben Seite.
function usePurchaseOnce(purchase: PurchaseEvent | null) {
  const sent = useRef(false)
  return useCallback(() => {
    if (!purchase || sent.current) return
    sent.current = true
    trackConversion.purchase(purchase.value, { transactionId: purchase.transactionId, currency: purchase.currency })
  }, [purchase])
}

function Shell({ tone, title, children }: { tone: 'success' | 'progress' | 'warning'; title: string; children: ReactNode }) {
  const icon =
    tone === 'success' ? (
      <CheckCircle aria-hidden="true" className="h-6 w-6" />
    ) : tone === 'progress' ? (
      <SpinnerGap aria-hidden="true" className="h-6 w-6 animate-spin motion-reduce:animate-none" />
    ) : (
      <WarningCircle aria-hidden="true" className="h-6 w-6" />
    )
  const iconClass =
    tone === 'success'
      ? 'bg-emerald-100 text-emerald-700'
      : tone === 'progress'
        ? 'bg-blue-100 text-blue-700'
        : 'bg-amber-100 text-amber-700'

  return (
    <div className="min-h-[70vh] bg-gray-50 px-4 py-10 sm:py-16">
      <Card className="mx-auto max-w-xl border-2 shadow-sm" role="status" aria-live="polite">
        <CardContent className="p-6 text-center sm:p-8">
          <div className={`mx-auto flex h-12 w-12 items-center justify-center rounded-full ${iconClass}`}>{icon}</div>
          <h1 className="mt-5 text-balance text-2xl font-bold text-gray-900 sm:text-3xl">{title}</h1>
          <div className="mt-3 space-y-3 text-pretty leading-relaxed text-gray-600">{children}</div>
        </CardContent>
      </Card>
    </div>
  )
}

function SignInButton({ label = 'Anmelden' }: { label?: string }) {
  return (
    <Button asChild size="lg" className="mt-3 w-full touch-manipulation sm:w-auto">
      <Link href={SIGN_IN_HREF} prefetch={false}>
        {label}
      </Link>
    </Button>
  )
}

function ContactLine() {
  return (
    <p className="text-sm text-gray-500">
      Falsche E-Mail-Adresse angegeben oder Fragen? Schreib an{' '}
      <a href={`mailto:${CONTACT_EMAIL}`} className="text-blue-700 underline underline-offset-2">
        {CONTACT_EMAIL}
      </a>
      .
    </p>
  )
}

function TicketSignIn({
  ticket,
  purchase,
  paymentPending,
}: {
  ticket: string
  purchase: PurchaseEvent | null
  paymentPending: boolean
}) {
  const { isLoaded, signIn, setActive } = useSignIn()
  const router = useRouter()
  const sendPurchase = usePurchaseOnce(purchase)
  const started = useRef(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!isLoaded || !signIn || started.current) return
    started.current = true
    void (async () => {
      try {
        const attempt = await signIn.create({ strategy: 'ticket', ticket })
        if (attempt.status !== 'complete' || !attempt.createdSessionId) throw new Error(`Sign-in status ${attempt.status}`)
        await setActive({ session: attempt.createdSessionId })
        sendPurchase()
        router.replace(DASHBOARD_WELCOME)
      } catch (error) {
        console.error('Automatic sign-in failed:', error)
        sendPurchase()
        setFailed(true)
      }
    })()
  }, [isLoaded, signIn, setActive, ticket, router, sendPurchase])

  if (failed) {
    return (
      <Shell tone="success" title={successTitle(paymentPending)}>
        <p>
          {bookedSentence(paymentPending)} Die automatische Anmeldung hat nicht geklappt. Den Login-Link und die
          Vertragsbestätigung schicken wir dir per E-Mail. Du kannst dich auch hier mit deiner E-Mail-Adresse anmelden
          und bekommst dann einen Code.
        </p>
        <PaymentPendingNote paymentPending={paymentPending} />
        <SignInButton />
        <ContactLine />
      </Shell>
    )
  }

  return (
    <Shell tone="progress" title={successTitle(paymentPending)}>
      <p>Wir melden dich an und öffnen deinen Mitgliederbereich.</p>
    </Shell>
  )
}

function RedirectToDashboard({ purchase, paymentPending }: { purchase: PurchaseEvent | null; paymentPending: boolean }) {
  const router = useRouter()
  const sendPurchase = usePurchaseOnce(purchase)
  useEffect(() => {
    sendPurchase()
    router.replace(DASHBOARD_WELCOME)
  }, [router, sendPurchase])

  return (
    <Shell tone="progress" title={successTitle(paymentPending)}>
      <p>Wir öffnen deinen Mitgliederbereich.</p>
      <Button asChild size="lg" variant="outline" className="mt-3 touch-manipulation">
        <Link href={DASHBOARD_WELCOME} prefetch={false}>
          Zum Mitgliederbereich
        </Link>
      </Button>
    </Shell>
  )
}

function PendingRefresh() {
  const router = useRouter()
  const [refreshes, setRefreshes] = useState(0)
  useEffect(() => {
    if (refreshes >= MAX_PENDING_REFRESHES) return
    const id = window.setTimeout(() => {
      setRefreshes((count) => count + 1)
      router.refresh()
    }, 3000)
    return () => window.clearTimeout(id)
  }, [refreshes, router])

  return (
    <Shell tone="progress" title="Buchung abgeschlossen">
      <p>Dein Zugang wird gerade eingerichtet. Das dauert meist nur wenige Sekunden.</p>
      {refreshes >= MAX_PENDING_REFRESHES ? (
        <>
          <p>Es dauert länger als üblich. Lade die Seite gleich noch einmal. Die Zahlung musst du nicht wiederholen.</p>
          <Button type="button" variant="outline" className="mt-3 touch-manipulation" onClick={() => router.refresh()}>
            Erneut prüfen
          </Button>
        </>
      ) : null}
    </Shell>
  )
}

function OtherAccount({
  emailMasked,
  purchase,
  paymentPending,
}: {
  emailMasked: string
  purchase: PurchaseEvent | null
  paymentPending: boolean
}) {
  const { signOut } = useClerk()
  const sendPurchase = usePurchaseOnce(purchase)
  useEffect(() => {
    sendPurchase()
  }, [sendPurchase])

  return (
    <Shell tone="success" title={successTitle(paymentPending)}>
      <p>
        Du bist gerade mit einem anderen Konto angemeldet. Die Buchung gehört zum Konto
        {emailMasked ? ` mit ${emailMasked}` : ' mit der E-Mail-Adresse aus der Zahlung'}. Melde dich ab und mit dieser
        Adresse wieder an.
      </p>
      <Button
        type="button"
        size="lg"
        className="mt-3 w-full touch-manipulation sm:w-auto"
        onClick={() => void signOut({ redirectUrl: SIGN_IN_HREF })}
      >
        Abmelden und neu anmelden
      </Button>
      <ContactLine />
    </Shell>
  )
}

function MailView({
  reason,
  emailMasked,
  purchase,
  paymentPending,
}: {
  reason: 'new-account' | 'existing-account' | 'too-old'
  emailMasked: string
  purchase: PurchaseEvent | null
  paymentPending: boolean
}) {
  const sendPurchase = usePurchaseOnce(purchase)
  useEffect(() => {
    sendPurchase()
  }, [sendPurchase])

  const address = emailMasked ? ` an ${emailMasked}` : ''

  if (reason === 'too-old') {
    return (
      <Shell tone="warning" title="Dieser Link ist abgelaufen">
        <p>
          Deine Buchung ist davon nicht betroffen. Melde dich mit der E-Mail-Adresse an, die du bei der Zahlung
          angegeben hast{emailMasked ? ` (${emailMasked})` : ''}.
        </p>
        <SignInButton />
        <ContactLine />
      </Shell>
    )
  }

  if (reason === 'existing-account') {
    return (
      <Shell tone="success" title={successTitle(paymentPending)}>
        <p>
          Die Mentorship ist in deinem bestehenden Konto{emailMasked ? ` mit ${emailMasked}` : ''}{' '}
          {paymentPending ? 'gebucht' : 'freigeschaltet'}. Melde dich wie gewohnt an. Die Vertragsbestätigung schicken
          wir dir per E-Mail.
        </p>
        <PaymentPendingNote paymentPending={paymentPending} />
        <SignInButton />
        <ContactLine />
      </Shell>
    )
  }

  return (
    <Shell tone="success" title={successTitle(paymentPending)}>
      <p>
        {bookedSentence(paymentPending)} Dein Login-Link ist per E-Mail{address} unterwegs, zusammen mit der
        Vertragsbestätigung. Du kannst dich auch hier mit dieser E-Mail-Adresse anmelden und bekommst dann einen Code.
      </p>
      <PaymentPendingNote paymentPending={paymentPending} />
      <SignInButton />
      <ContactLine />
    </Shell>
  )
}

export function WelcomeView({ state }: { state: WelcomeState }) {
  switch (state.kind) {
    case 'ticket':
      return <TicketSignIn ticket={state.ticket} purchase={state.purchase} paymentPending={state.paymentPending} />
    case 'redirect':
      return <RedirectToDashboard purchase={state.purchase} paymentPending={state.paymentPending} />
    case 'pending':
      return <PendingRefresh />
    case 'mail':
      return state.reason === 'other-account-signed-in' ? (
        <OtherAccount emailMasked={state.emailMasked} purchase={state.purchase} paymentPending={state.paymentPending} />
      ) : (
        <MailView
          reason={state.reason}
          emailMasked={state.emailMasked}
          purchase={state.purchase}
          paymentPending={state.paymentPending}
        />
      )
    case 'not-complete':
      return (
        <Shell tone="warning" title="Zahlung noch nicht abgeschlossen">
          <p>Diese Zahlung ist nicht abgeschlossen. Es wurde nichts gebucht. Du kannst die Buchung neu starten.</p>
          <Button asChild size="lg" className="mt-3 touch-manipulation">
            <Link href="/checkout" prefetch={false}>
              Zur Buchung
            </Link>
          </Button>
        </Shell>
      )
    case 'error':
      return (
        <Shell tone="warning" title="Zugang wird noch eingerichtet">
          <p>
            Dein Zugang konnte gerade nicht eingerichtet werden. Die Zahlung musst du nicht wiederholen. Lade die Seite
            in einer Minute neu.
          </p>
          <ContactLine />
        </Shell>
      )
    default:
      return (
        <Shell tone="warning" title="Link ungültig">
          <p>
            Dieser Link ist ungültig. Wenn du gerade bezahlt hast, findest du den Login-Link in deinem E-Mail-Postfach,
            oder du meldest dich mit deiner E-Mail-Adresse an.
          </p>
          <SignInButton />
          <ContactLine />
        </Shell>
      )
  }
}
