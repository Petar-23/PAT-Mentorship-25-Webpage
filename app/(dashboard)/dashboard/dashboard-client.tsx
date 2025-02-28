'use client'

import { useSearchParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { CalendarCheck, LockIcon, CircleCheckBig, CreditCard, BookOpen, ExternalLink } from 'lucide-react'
import { CheckoutButton } from '@/components/ui/checkout-button'
import { Button } from '@/components/ui/button'
import { ManageSubscriptionButton } from '@/components/ui/manage-subscription'
import { SubscriptionStatus } from '@/components/dashboard/subscription-status'
import { SubscriptionSuccessModal } from '@/components/dashboard/subscription-success-modal'
import { motion } from 'framer-motion'
import { useState, useCallback } from 'react'

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
  const [showSuccessModal, setShowSuccessModal] = useState(
    searchParams.get('success') === 'true'
  )
  
  const handleCloseModal = useCallback(() => {
    setShowSuccessModal(false)
    
    // Optionally clean up the URL without a redirect
    if (window.history.replaceState) {
      window.history.replaceState({}, '', '/dashboard')
    }
  }, [])
  
  const startDate = new Date('2025-03-01')
  const programStarted = new Date() >= startDate
  const hasSubscriptionHistory = initialData.subscriptionDetails !== null

  // YouTube video ID - replace with your actual video ID
  const videoId = "v2aOTaZQd98?si=AVXo7jYBzNi1QZJT"

  // Show the streamlined conversion page for new users
  if (!hasSubscriptionHistory) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <motion.div 
          className="container mx-auto px-4 max-w-4xl"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6 }}
        >
          {/* Welcome Section */}
          <div className="text-center mb-12">
            <motion.div {...fadeInUp}>
              <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
                Willkommen, {initialData.user.firstName || 'zukünftiger Trader'}!
              </h1>
              <p className="text-lg text-gray-600">
                Du bist dabei, meiner exklusiven ICT Mentorship 2025 beizutreten.
              </p>
            </motion.div>
          </div>

          {/* Main Card */}
          <Card className="mb-8 shadow-sm border-2">
            <CardContent className="p-8">
              {/* Payment Highlight Box */}
              <div className="bg-green-50 border border-green-300 rounded-lg p-4 mb-8">
                <div className="flex items-center gap-3 text-green-700">
                  <CalendarCheck className="h-5 w-5 flex-shrink-0" />
                  <div>
                    <p className="font-medium">Keine Zahlung bis März 2025</p>
                    <p className="text-sm text-green-600 mt-1">
                      Jetzt sichern, Zahlung erst ab 01. März 2025
                    </p>
                  </div>
                </div>
              </div>

              {/* Price Tag */}
              <div className="text-center mb-8">
                <div className="flex items-baseline justify-center">
                  <span className="text-5xl font-bold text-gray-900">€150</span>
                  <span className="text-xl text-gray-500 ml-2">/Monat</span>
                </div>
                <p className="text-sm text-gray-500 mt-2">
                  Erste Zahlung am 01. März 2025
                </p>
              </div>

              {/* Benefits List */}
              <div className="grid sm:grid-cols-2 gap-4 mb-8">
                {[
                  "Live Trading/Coaching Sessions 2-3x wöchentlich",
                  "Zugang zur privaten Discord-Community",
                  "Umfassendes Lernmaterial",
                  "Interaktive Frage & Antwort Sessions",
                  "Dauerhafter Zugang nach Abschluss",
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
              <div className="space-y-4">
                <CheckoutButton />
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

  // Existing dashboard for subscribed users
  const canAccessContent = initialData.hasSubscription && 
    !initialData.subscriptionDetails?.isCanceled &&
    programStarted

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
          {/* Onboarding Video */}
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle>Onboarding Video</CardTitle>
              <CardDescription>
                Ich helfe dir alles zu finden
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="relative pb-[56.25%] h-0 overflow-hidden rounded-lg">
                <iframe 
                  className="absolute top-0 left-0 w-full h-full"
                  src={`https://www.youtube.com/embed/${videoId}`}
                  title="PAT Mentorship 2025 Onboarding"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                ></iframe>
              </div>
              <p className="text-gray-600 mt-4 text-sm">
                Schau dir dieses Video an, um zu erfahren, wie du an alle Inhalte kommst.
              </p>
            </CardContent>
          </Card>
          
          {/* Whop Access */}
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-blue-600" />
                Kursinhalte & Community
              </CardTitle>
              <CardDescription>
                Zugriff auf deine Lernmaterialien und das Mentorship Forum
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 mb-4">
                Greife auf deine Videolektionen, Ressourcen und Discord Community zu. Die Whop-Plattform verwaltet automatisch deinen Zugang zu allen Kursinhalten und der Discord Community.
              </p>
              
              {canAccessContent ? (
                <a 
                  href={process.env.NEXT_PUBLIC_WHOP_COURSE_URL || "https://whop.com/checkout/plan_TtPFXidmjPAT7"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors gap-2"
                >
                  <ExternalLink className="h-5 w-5 mr-2" />
                  Zur Mentorship
                </a>
              ) : (
                <Button 
                  className="w-full bg-blue-600 hover:bg-blue-600 cursor-not-allowed opacity-60"
                  disabled
                >
                  <ExternalLink className="h-5 w-5 mr-2" />
                  Verfügbar ab dem 01. März 2025
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
                    Dein Abonnement wurde gekündigt. Erneuere jetzt dein Abonnement, um deinen Platz für das Programm ab 01. März 2025 zu sichern.
                  </p>
                ) : (
                  <>
                    <p>Dein Abonnement startet am 01. März 2025.</p>
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