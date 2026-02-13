'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { CalendarCheck, LockIcon, CircleCheckBig, CreditCard, BookOpen, Ticket } from 'lucide-react'
import { CheckoutButton } from '@/components/ui/checkout-button'
import { Button } from '@/components/ui/button'
import { ManageSubscriptionButton } from '@/components/ui/manage-subscription'
import { SubscriptionStatus } from '@/components/dashboard/subscription-status'
import { SubscriptionSuccessModal } from '@/components/dashboard/subscription-success-modal'
import { motion } from 'framer-motion'
import { useState, useCallback, useEffect, useRef } from 'react'
import { trackConversion } from '@/components/analytics/google-tag-manager'

interface DashboardClientProps {
  initialData: {
    hasSubscription: boolean;
    subscriptionDetails: {
      status: string;
      startDate: string;
      isPending: boolean;
      isCanceled: boolean;
      cancelAt: string | null;
    } | null;
    user: {
      firstName: string | null;
    }
  }
}

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5 }
}

export default function DashboardClient({ initialData }: DashboardClientProps) {
  const searchParams = useSearchParams()
  const showCoursesPaywall = searchParams.get('paywall') === 'courses'
  const showMentorshipNotStarted = searchParams.get('message') === 'mentorship-not-started'
  const [showSuccessModal, setShowSuccessModal] = useState(
    searchParams.get('success') === 'true'
  )
  const [mentorshipStatus, setMentorshipStatus] = useState<{ accessible: boolean; startDate: string } | null>(null)
  const hasTrackedPurchase = useRef(false)
  
  // Track Purchase Conversion wenn User von erfolgreicher Zahlung kommt
  useEffect(() => {
    if (searchParams.get('success') === 'true' && !hasTrackedPurchase.current) {
      hasTrackedPurchase.current = true
      trackConversion.purchase(150)
    }
  }, [searchParams])

  // Lade Mentorship-Status
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const res = await fetch('/api/mentorship-status', { cache: 'no-store' })
        if (!res.ok) return
        const data = await res.json()
        if (!cancelled) setMentorshipStatus(data)
      } catch (err) {
        console.error('Failed to load mentorship status:', err)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  // State für Checkbox
  const [termsAccepted, setTermsAccepted] = useState(false)
  
  const handleCloseModal = useCallback(() => {
    setShowSuccessModal(false)
    
    if (window.history.replaceState) {
      window.history.replaceState({}, '', '/dashboard')
    }
  }, [])

  const clearPaywallParam = useCallback(() => {
    if (window.history.replaceState) {
      window.history.replaceState({}, '', '/dashboard')
    }
  }, [])
  
  const hasSubscriptionHistory = initialData.subscriptionDetails !== null

  // Conversion page für neue User
  if (!hasSubscriptionHistory) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <motion.div 
          className="container mx-auto px-4 max-w-4xl"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6 }}
        >
          {showCoursesPaywall && (
            <motion.div {...fadeInUp} className="mb-8">
              <Card className="border-amber-200 bg-amber-50 shadow-sm">
                <CardContent className="p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
                      <LockIcon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-semibold text-amber-900">
                        Zugriff auf den Kursbereich gesperrt
                      </p>
                      <p className="text-sm text-amber-900/80 mt-1">
                        Um die Kurse zu öffnen, brauchst du ein aktives Mentorship‑Abo.
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Button variant="outline" asChild className="w-full sm:w-auto">
                      <a href="#checkout-cta">Jetzt freischalten</a>
                    </Button>
                    <Button
                      variant="ghost"
                      className="w-full sm:w-auto"
                      onClick={clearPaywallParam}
                    >
                      Später
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {showMentorshipNotStarted && (
            <motion.div {...fadeInUp} className="mb-8">
              <Card className="border-blue-200 bg-blue-50 shadow-sm">
                <CardContent className="p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
                      <CalendarCheck className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-semibold text-blue-900">
                        Mentorship startet bald
                      </p>
                      <p className="text-sm text-blue-900/80 mt-1">
                        Du hast bereits ein aktives Abo! Der Mentorship-Bereich öffnet am 01.03.2026.
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Button
                      variant="ghost"
                      className="w-full sm:w-auto"
                      onClick={clearPaywallParam}
                    >
                      Verstanden
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Welcome Section */}
          <div className="text-center mb-12">
            <motion.div {...fadeInUp}>
              <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
                Willkommen, {initialData.user.firstName || 'zukünftiger Trader'}!
              </h1>
              <p className="text-lg text-gray-600">
                Noch wenige Plätze verfügbar — sichere dir deinen Zugang zur M26.
              </p>
            </motion.div>
          </div>

          {/* Main Card */}
          <Card className="mb-8 shadow-sm border-2">
            <CardContent className="p-8">
              {/* Urgency Banner */}
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

              {/* Price Tag */}
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

              {/* Benefits List */}
              <div className="grid sm:grid-cols-2 gap-4 mb-8">
                {[
                  "2 Live-Sessions pro Woche (Di + Do)",
                  "Tagesausblick am Dienstag und Donnerstag",
                  "Wöchentlicher Marktausblick mit Draw on Liquidity",
                  "3-4 vollständige Trading-Modelle mit Trading Plan",
                  "Exklusive Community (max. 100 Trader)",
                  "Monatlich kündbar"
                ].map((benefit, index) => (
                  <motion.div
                    key={index}
                    className="flex items-start gap-3 bg-gray-50 p-3 rounded-lg border border-gray-200"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <div className="flex-shrink-0 mt-0.5">
                      <CircleCheckBig className="h-5 w-5 text-green-400" />
                    </div>
                    <span className="text-gray-700 text-sm">{benefit}</span>
                  </motion.div>
                ))}
              </div>

              {/* CTA Section */}
              <div id="checkout-cta" className="space-y-6">
                {/* Checkbox */}
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

          {/* Value Props */}
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
        </motion.div>
      </div>
    )
  }

  return (
    <>
      {showSuccessModal && (
        <SubscriptionSuccessModal 
          isOpen={true} 
          onClose={handleCloseModal}
        />
      )}

      <div className="container mx-auto py-10 px-4">
        <h1 className="text-3xl font-bold mb-8">
          Willkommen, {initialData.user.firstName || 'Mitglied'}!
        </h1>

        {showCoursesPaywall && !initialData.hasSubscription && (
          <div className="mb-8">
            <Card className="border-amber-200 bg-amber-50 shadow-sm">
              <CardContent className="p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
                    <LockIcon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-amber-900">Kursbereich gesperrt</p>
                    <p className="text-sm text-amber-900/80 mt-1">
                      Dein Abo ist aktuell nicht aktiv. Bitte prüfe dein Stripe‑Abo oder schließe es ab.
                    </p>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="w-full sm:w-[240px]">
                    <ManageSubscriptionButton />
                  </div>
                  <Button
                    variant="ghost"
                    className="w-full sm:w-auto"
                    onClick={clearPaywallParam}
                  >
                    Okay
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {initialData.subscriptionDetails && (
          <div className="mb-8">
            <SubscriptionStatus
              startDate={initialData.subscriptionDetails.startDate}
              status={initialData.subscriptionDetails.status}
              isPending={initialData.subscriptionDetails.isPending}
              isCanceled={initialData.subscriptionDetails.isCanceled}
              cancelAt={initialData.subscriptionDetails.cancelAt}
            />
          </div>
        )}
        
        <div className="grid gap-6">
          {/* Mentorship Access */}
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-blue-600" />
                Kursinhalte & Community
              </CardTitle>
              <CardDescription>
                Direkt zum Mentorship‑Bereich
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 mb-4">
                Hier kommst du direkt zur Discord‑Verknüpfung und zum Mentorship‑Bereich.
              </p>

              {!mentorshipStatus?.accessible ? (
                <Button
                  disabled
                  className="w-full bg-blue-600 hover:bg-blue-600 opacity-60 cursor-not-allowed"
                  title="Mentorship startet am 01.03.2026"
                >
                  Zur Mentorship Platform (Startet am 01.03.2026)
                </Button>
              ) : (
                <Button asChild className="w-full bg-blue-600 hover:bg-blue-700">
                  <Link href="/mentorship">Zur Mentorship Platform</Link>
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Subscription Management */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Abonnement Verwalten
              </CardTitle>
              <CardDescription>
                Verwalte dein Abonnement und deine Zahlungsdetails
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm text-gray-600">
                {initialData.subscriptionDetails?.isCanceled ? (
                  <p className="text-red-600">
                    Dein Abonnement wurde gekündigt. Erneuere jetzt dein Abonnement, um deinen Platz für das Programm ab 01. März 2026 zu sichern.
                  </p>
                ) : (
                  <>
                    <p>Dein Abonnement startet am 01. März 2026. Die erste Zahlung erfolgt automatisch an diesem Datum.</p>
                    <p>Du kannst deine Zahlungsmethode und Abonnement-Einstellungen unten verwalten.</p>
                  </>
                )}
              </div>
              <ManageSubscriptionButton />
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}