'use client'

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BookOpen } from '@phosphor-icons/react/BookOpen'
import { CalendarCheck } from '@phosphor-icons/react/CalendarCheck'
import { CheckCircle as CircleCheckBig } from '@phosphor-icons/react/CheckCircle'
import { LockIcon } from '@phosphor-icons/react/Lock'
import { Ticket } from '@phosphor-icons/react/Ticket'
import { trackConversion } from '@/components/analytics/tracking'

const CheckoutButton = dynamic(
  () => import('@/components/ui/checkout-button').then((mod) => mod.CheckoutButton),
  {
    ssr: false,
    loading: () => (
      <Button disabled className="w-full text-lg py-6" size="lg">
        Checkout wird geladen...
      </Button>
    ),
  }
)

type DashboardConversionClientProps = {
  firstName: string | null
  viewFlags: {
    showCheckoutSuccess: boolean
    showCoursesPaywall: boolean
    showMentorshipNotStarted: boolean
  }
}

export default function DashboardConversionClient({
  firstName,
  viewFlags,
}: DashboardConversionClientProps) {
  const { showCheckoutSuccess, showCoursesPaywall, showMentorshipNotStarted } = viewFlags
  const [termsAccepted, setTermsAccepted] = useState(false)
  const hasTrackedPurchase = useRef(false)

  useEffect(() => {
    if (showCheckoutSuccess && !hasTrackedPurchase.current) {
      hasTrackedPurchase.current = true
      trackConversion.purchase(150)
    }
  }, [showCheckoutSuccess])

  const clearPaywallParam = useCallback(() => {
    if (window.history.replaceState) {
      window.history.replaceState({}, '', '/dashboard')
    }
  }, [])

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="container mx-auto px-4 max-w-4xl animate-in fade-in duration-500">
        {showCoursesPaywall && (
          <div className="mb-8 animate-in fade-in slide-in-from-bottom-3 duration-500">
            <Card className="border-amber-200 bg-amber-50 shadow-sm">
              <CardContent className="p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
                    <LockIcon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-amber-900">Zugriff auf den Kursbereich gesperrt</p>
                    <p className="text-sm text-amber-900/80 mt-1">
                      Um die Kurse zu öffnen, brauchst du ein aktives Mentorship-Abo.
                    </p>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button variant="outline" asChild className="w-full sm:w-auto">
                    <a href="#checkout-cta">Jetzt freischalten</a>
                  </Button>
                  <Button variant="ghost" className="w-full sm:w-auto" onClick={clearPaywallParam}>
                    Später
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {showMentorshipNotStarted && (
          <div className="mb-8 animate-in fade-in slide-in-from-bottom-3 duration-500">
            <Card className="border-blue-200 bg-blue-50 shadow-sm">
              <CardContent className="p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
                    <CalendarCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-blue-900">Mentorship startet bald</p>
                    <p className="text-sm text-blue-900/80 mt-1">
                      Du hast bereits ein aktives Abo! Der Mentorship-Bereich öffnet am 01.03.2026.
                    </p>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button variant="ghost" className="w-full sm:w-auto" onClick={clearPaywallParam}>
                    Verstanden
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <div className="text-center mb-12">
          <div className="animate-in fade-in slide-in-from-bottom-3 duration-500">
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Willkommen, {firstName || 'zukünftiger Trader'}!
            </h1>
            <p className="text-lg text-gray-600">
              Noch wenige Plätze verfügbar - sichere dir deinen Zugang zur M26.
            </p>
          </div>
        </div>

        <Card className="mb-8 shadow-sm border-2">
          <CardContent className="p-8">
            <div className="bg-amber-50 border-2 border-amber-400 rounded-lg p-5 mb-8">
              <div className="text-center">
                <p className="text-2xl font-bold text-amber-900 flex items-center justify-center gap-2">
                  <Ticket className="w-6 h-6 shrink-0" />
                  Nur noch wenige der 100 Plätze verfügbar
                </p>
                <p className="text-sm text-amber-700 mt-2">
                  Die Vergabe erfolgt nach dem Prinzip: Wer zuerst kommt, mahlt zuerst.
                </p>
              </div>
            </div>

            <div className="text-center mb-8">
              <div className="flex items-baseline justify-center">
                <span className="text-5xl font-bold text-gray-900">€150</span>
                <span className="text-xl text-gray-500 ml-2">/Monat</span>
              </div>
              <p className="text-sm text-gray-600 mt-2 font-medium">
                inkl. gesetzl. MwSt. · monatlich kündbar
              </p>
              <p className="text-sm text-green-600 mt-1 font-medium">
                Keine Zahlung bis 01. März 2026
              </p>
            </div>

            <div className="grid sm:grid-cols-2 gap-4 mb-8">
              {[
                '2 Live-Sessions pro Woche (Di + Do)',
                'Tagesausblick am Dienstag und Donnerstag',
                'Wöchentlicher Marktausblick mit Draw on Liquidity',
                '3-4 vollständige Trading-Modelle mit Trading Plan',
                'Exklusive Community (max. 100 Trader)',
                'Monatlich kündbar',
              ].map((benefit, index) => (
                <div
                  key={benefit}
                  className="flex items-start gap-3 bg-gray-50 p-3 rounded-lg border border-gray-200 animate-in fade-in slide-in-from-bottom-2 duration-500"
                  style={{ animationDelay: `${index * 75}ms` }}
                >
                  <div className="flex-shrink-0 mt-0.5">
                    <CircleCheckBig className="h-5 w-5 text-green-400" />
                  </div>
                  <span className="text-gray-700 text-sm">{benefit}</span>
                </div>
              ))}
            </div>

            <div id="checkout-cta" className="space-y-6">
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id="terms"
                  checked={termsAccepted}
                  onChange={(e) => setTermsAccepted(e.target.checked)}
                  className="mt-1 h-5 w-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                />
                <label htmlFor="terms" className="text-sm text-gray-700 leading-relaxed">
                  Ich akzeptiere die{' '}
                  <a href="/AGB" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline hover:text-blue-800">
                    AGB
                  </a>
                  , habe die{' '}
                  <a href="/Widerruf" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline hover:text-blue-800">
                    Widerrufsbelehrung
                  </a>{' '}
                  zur Kenntnis genommen und stimme der{' '}
                  <a href="/datenschutz" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline hover:text-blue-800">
                    Datenschutzerklärung
                  </a>{' '}
                  zu.
                </label>
              </div>

              <CheckoutButton disabled={!termsAccepted} />

              <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
                <LockIcon className="h-4 w-4" />
                <span>Sichere Zahlung über Stripe</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid md:grid-cols-2 gap-6">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-blue-600" />
                Interaktives Live-Lernen
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 text-sm">
                Lerne durch Live-Sessions mit Echtzeit-Marktanalysen, direktem Feedback
                und interaktiven Frage & Antwort Runden. Perfekt für Anfänger und erfahrene Trader.
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LockIcon className="h-5 w-5 text-blue-600" />
                Risikofreie Entscheidung
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 text-sm">
                Faire Bedingungen - kündige jederzeit, wenn du nicht vollständig zufrieden bist.
                Erhalte dauerhaften Zugang nach Abschluss der Mentorship (12 Monate).
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
