'use client'

import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowClockwise } from '@phosphor-icons/react/ArrowClockwise'
import { BookOpen } from '@phosphor-icons/react/BookOpen'
import { CalendarCheck } from '@phosphor-icons/react/CalendarCheck'
import { CheckCircle as CircleCheckBig } from '@phosphor-icons/react/CheckCircle'
import { LockIcon } from '@phosphor-icons/react/Lock'
import { SpinnerGap } from '@phosphor-icons/react/SpinnerGap'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { MENTORSHIP_CONFIG, MENTORSHIP_IS_UPCOMING } from '@/lib/config'

const CheckoutButton = dynamic(
  () => import('@/components/ui/checkout-button').then((mod) => mod.CheckoutButton),
  {
    ssr: false,
    loading: () => (
      <Button disabled className="w-full py-6 text-base sm:text-lg" size="lg">
        Checkout wird geladen…
      </Button>
    ),
  }
)

const benefits = [
  '2 Live-Sessions pro Woche (Di + Do)',
  'Tagesausblick am Dienstag und Donnerstag',
  'Wöchentlicher Marktausblick mit Draw on Liquidity',
  '3–4 vollständige Trading-Modelle mit Trading Plan',
  'Fokussierte Community für Austausch und Feedback',
  'Alle Aufzeichnungen während deiner Mitgliedschaft',
]

type DashboardConversionClientProps = {
  firstName: string | null
  viewFlags: {
    showCheckoutSuccess: boolean
    showCheckoutCanceled: boolean
    showCoursesPaywall: boolean
    showMentorshipNotStarted: boolean
  }
}

export default function DashboardConversionClient({
  firstName,
  viewFlags,
}: DashboardConversionClientProps) {
  const {
    showCheckoutSuccess,
    showCheckoutCanceled,
    showCoursesPaywall,
    showMentorshipNotStarted,
  } = viewFlags
  const router = useRouter()
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [confirmationChecks, setConfirmationChecks] = useState(0)
  const [showCanceledNotice, setShowCanceledNotice] = useState(showCheckoutCanceled)

  useEffect(() => {
    if (!showCheckoutSuccess || confirmationChecks >= 2) return

    const timeoutId = window.setTimeout(() => {
      setConfirmationChecks((current) => current + 1)
      router.refresh()
    }, 2500)

    return () => window.clearTimeout(timeoutId)
  }, [confirmationChecks, router, showCheckoutSuccess])

  const clearPaywallParam = () => {
    if (window.history.replaceState) {
      window.history.replaceState({}, '', '/dashboard')
    }
  }

  const dismissCanceledNotice = () => {
    setShowCanceledNotice(false)
    if (window.history.replaceState) {
      window.history.replaceState({}, '', '/dashboard')
    }
  }

  if (showCheckoutSuccess) {
    return (
      <div className="min-h-screen bg-gray-50 px-4 py-10 sm:py-16">
        <Card className="mx-auto max-w-xl border-blue-200 shadow-sm" role="status" aria-live="polite">
          <CardContent className="p-6 text-center sm:p-8">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-blue-700">
              <SpinnerGap aria-hidden="true" className="h-6 w-6 animate-spin motion-reduce:animate-none" />
            </div>
            <h1 className="mt-5 text-balance text-2xl font-bold text-gray-900 sm:text-3xl">
              Deine Zahlung wird bestätigt
            </h1>
            <p className="mt-3 text-pretty leading-relaxed text-gray-600">
              Stripe hat dich zurückgeleitet. Die Freischaltung kann einen kurzen Moment dauern;
              wir prüfen deinen Zugang automatisch.
            </p>
            <p className="mt-5 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
              Bitte starte jetzt keinen zweiten Checkout – dein Zahlungsstatus wird bereits verarbeitet.
            </p>
            <Button
              type="button"
              variant="outline"
              className="mt-6 touch-manipulation"
              onClick={() => router.refresh()}
            >
              <ArrowClockwise aria-hidden="true" className="h-4 w-4" />
              Status erneut prüfen
            </Button>
            {confirmationChecks >= 2 ? (
              <p className="mt-4 text-sm text-gray-500">
                Die Bestätigung dauert länger als üblich. Lade die Seite in wenigen Minuten erneut.
              </p>
            ) : (
              <p className="mt-4 text-sm text-gray-500">Automatische Prüfung läuft…</p>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-6 sm:py-12">
      <div className="container mx-auto max-w-4xl px-4">
        {showCanceledNotice ? (
          <Card className="mb-6 border-blue-200 bg-blue-50 shadow-sm" role="status">
            <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
                  <LockIcon aria-hidden="true" className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold text-blue-950">Checkout abgebrochen</p>
                  <p className="mt-1 text-sm text-blue-900/80">
                    Dieser Checkout wurde nicht abgeschlossen. Du kannst deine Konditionen in Ruhe prüfen.
                  </p>
                </div>
              </div>
              <Button type="button" variant="ghost" className="touch-manipulation" onClick={dismissCanceledNotice}>
                Verstanden
              </Button>
            </CardContent>
          </Card>
        ) : null}

        {showCoursesPaywall ? (
          <Card className="mb-6 border-amber-200 bg-amber-50 shadow-sm">
            <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
                  <LockIcon aria-hidden="true" className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold text-amber-900">Zugriff auf den Kursbereich gesperrt</p>
                  <p className="mt-1 text-sm text-amber-900/80">
                    Um die Kurse zu öffnen, brauchst du ein aktives Mentorship-Abo.
                  </p>
                </div>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button variant="outline" asChild className="w-full touch-manipulation sm:w-auto">
                  <a href="#checkout-cta">Zum Checkout</a>
                </Button>
                <Button variant="ghost" className="w-full touch-manipulation sm:w-auto" onClick={clearPaywallParam}>
                  Später
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {showMentorshipNotStarted ? (
          <Card className="mb-6 border-blue-200 bg-blue-50 shadow-sm">
            <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
                  <CalendarCheck aria-hidden="true" className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold text-blue-900">
                    {MENTORSHIP_IS_UPCOMING ? 'Mentorship startet bald' : 'Mentorship-Zugang wird vorbereitet'}
                  </p>
                  <p className="mt-1 text-sm text-blue-900/80">
                    {MENTORSHIP_IS_UPCOMING
                      ? `Du hast bereits ein aktives Abo. Der Mentorship-Bereich öffnet am ${MENTORSHIP_CONFIG.startDateFormatted}.`
                      : 'Du hast bereits ein aktives Abo. Lade die Seite neu, falls der Mentorship-Bereich noch nicht freigeschaltet ist.'}
                  </p>
                </div>
              </div>
              <Button variant="ghost" className="touch-manipulation" onClick={clearPaywallParam}>
                Verstanden
              </Button>
            </CardContent>
          </Card>
        ) : null}

        <header className="mb-8 text-center sm:mb-10">
          <p className="text-sm font-medium text-blue-700">Willkommen{firstName ? `, ${firstName}` : ''}</p>
          <h1 className="mt-2 text-balance text-3xl font-bold text-gray-900 sm:text-4xl">
            Dein Einstieg in die {MENTORSHIP_CONFIG.programName}
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-pretty text-gray-600 sm:text-lg">
            Prüfe die Konditionen und buche im nächsten Schritt sicher über Stripe.
          </p>
        </header>

        <Card className="mb-8 border-2 shadow-sm">
          <CardContent className="p-5 sm:p-8">
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 sm:p-5">
              <p className="font-semibold text-blue-950">So geht es weiter</p>
              <ol className="mt-4 grid gap-4 sm:grid-cols-3" aria-label="Buchungsfortschritt">
                <li className="flex items-center gap-3 sm:block">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-sm font-semibold text-white sm:mb-2">
                    ✓
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Konto erstellt</p>
                    <p className="text-xs text-gray-600">Schritt 1 erledigt</p>
                  </div>
                </li>
                <li className="flex items-center gap-3 sm:block">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-700 text-sm font-semibold text-white sm:mb-2">
                    2
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Konditionen bestätigen</p>
                    <p className="text-xs text-gray-600">Jetzt hier</p>
                  </div>
                </li>
                <li className="flex items-center gap-3 sm:block">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-sm font-semibold text-gray-700 ring-1 ring-gray-300 sm:mb-2">
                    3
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Sicher bezahlen</p>
                    <p className="text-xs text-gray-600">Bei Stripe abschließen</p>
                  </div>
                </li>
              </ol>
            </div>

            <div className="my-7 text-center">
              <div className="flex items-baseline justify-center">
                <span className="text-4xl font-bold text-gray-900 sm:text-5xl">{MENTORSHIP_CONFIG.priceFormatted}</span>
                <span className="ml-2 text-lg text-gray-500 sm:text-xl">/Monat</span>
              </div>
              <p className="mt-2 text-sm font-medium text-gray-600">
                inkl. gesetzl. MwSt. · monatlich kündbar mit 1 Tag Frist zum Monatsende
              </p>
              <p className="mt-1 text-sm font-medium text-emerald-700">
                {MENTORSHIP_IS_UPCOMING
                  ? `Keine Zahlung bis ${MENTORSHIP_CONFIG.startDateFormatted}`
                  : 'Zugang nach erfolgreicher Zahlung und Freischaltung'}
              </p>
            </div>

            <div id="checkout-cta" className="space-y-5 scroll-mt-6">
              <div className="flex items-start gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
                <input
                  type="checkbox"
                  id="terms"
                  checked={termsAccepted}
                  onChange={(event) => setTermsAccepted(event.target.checked)}
                  className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer rounded border-gray-300 text-blue-600 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
                />
                <div className="text-sm leading-relaxed text-gray-700">
                  <label htmlFor="terms" className="cursor-pointer">
                    Ich akzeptiere die folgenden Bedingungen:
                  </label>{' '}
                  <a href="/AGB" target="_blank" rel="noopener noreferrer" className="text-blue-700 underline underline-offset-2 hover:text-blue-900">
                    AGB
                  </a>
                  ,{' '}
                  <a href="/Widerruf" target="_blank" rel="noopener noreferrer" className="text-blue-700 underline underline-offset-2 hover:text-blue-900">
                    Widerrufsbelehrung
                  </a>{' '}und{' '}
                  <a href="/datenschutz" target="_blank" rel="noopener noreferrer" className="text-blue-700 underline underline-offset-2 hover:text-blue-900">
                    Datenschutzerklärung
                  </a>.
                </div>
              </div>

              <CheckoutButton
                disabled={!termsAccepted}
                disabledReason="Bitte akzeptiere zuerst AGB, Widerruf und Datenschutz."
                label={`Weiter zu Stripe – ${MENTORSHIP_CONFIG.priceFormatted}/Monat`}
              />

              <div className="text-center text-sm text-gray-500">
                <p className="flex items-center justify-center gap-2">
                  <LockIcon aria-hidden="true" className="h-4 w-4" />
                  Sichere Zahlung über Stripe
                </p>
                <p className="mt-1">
                  Dein Platz ist erst nach erfolgreichem Abschluss bei Stripe gebucht.
                </p>
              </div>
            </div>

            <div className="mt-8 border-t border-gray-200 pt-7">
              <h2 className="text-lg font-semibold text-gray-900">Das ist enthalten</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {benefits.map((benefit) => (
                  <div key={benefit} className="flex items-start gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
                    <CircleCheckBig aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                    <span className="text-sm text-gray-700">{benefit}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 md:grid-cols-2">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen aria-hidden="true" className="h-5 w-5 text-blue-600" />
                Interaktives Live-Lernen
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">
                Lerne durch Live-Sessions mit Echtzeit-Marktanalysen, direktem Feedback
                und interaktiven Frage-und-Antwort-Runden.
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LockIcon aria-hidden="true" className="h-5 w-5 text-blue-600" />
                Flexible Entscheidung
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">
                Zahle monatlich und kündige mit 1 Tag Frist zum Monatsende, wenn das Mentorship nicht mehr zu dir passt.
                Bis zum Ende der bezahlten Periode bleibt dein Zugang erhalten.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
