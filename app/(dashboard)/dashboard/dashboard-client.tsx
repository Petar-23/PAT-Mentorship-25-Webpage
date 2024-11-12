'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { CalendarCheck, LockIcon, CircleCheckBig, CreditCard, Users, Shield } from 'lucide-react'
import { CheckoutButton } from '@/components/ui/checkout-button'
import { Button } from '@/components/ui/button'
import { ManageSubscriptionButton } from '@/components/ui/manage-subscription'
import { SubscriptionStatus } from '@/components/dashboard/subscription-status'
import { SubscriptionSuccessModal } from '@/components/dashboard/subscription-success-modal'
import { motion } from 'framer-motion'

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
  const router = useRouter()
  const searchParams = useSearchParams()
  const showSuccess = searchParams.get('success') === 'true'
  
  const startDate = new Date('2025-03-01')
  const programStarted = new Date() >= startDate
  const hasSubscriptionHistory = initialData.subscriptionDetails !== null

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
                      Jetzt reservieren, Zahlung erst ab 1. März 2025
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
                  Erste Zahlung am 1. März 2025
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
                  <Users className="h-5 w-5 text-blue-600" />
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
                  <Shield className="h-5 w-5 text-blue-600" />
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
      {showSuccess && (
        <SubscriptionSuccessModal 
          isOpen={true} 
          onClose={() => {
            router.replace('/dashboard')
          }} 
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
        
        <div className="grid md:grid-cols-2 gap-6">
          {/* Discord Access */}
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <svg 
                  className="h-5 w-5 text-[#5865F2]" 
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.118.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.419c0 1.334-.956 2.419-2.157 2.419zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.419c0 1.334-.946 2.419-2.157 2.419z"/>
                </svg>
                Discord Community
              </CardTitle>
              <CardDescription>
                Verbinde dich mit Mentoren und anderen Teilnehmern
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 mb-4">
                Tritt unserer exklusiven Discord-Community bei für Live-Sessions, Diskussionen und Networking.
              </p>
              {canAccessContent && programStarted ? (
                <a 
                  href={process.env.NEXT_PUBLIC_DISCORD_INVITE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center w-full px-4 py-2 bg-[#5865F2] text-white rounded-md hover:bg-[#4752C4] transition-colors gap-2"
                >
                  Discord Server beitreten
                </a>
              ) : (
                <Button 
                  className="w-full bg-[#5865F2] hover:bg-[#5865F2] cursor-not-allowed opacity-60"
                  disabled
                >
                  Verfügbar ab 1. März 2025
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Whop Access */}
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle>Kursinhalte</CardTitle>
              <CardDescription>
                Zugriff auf deine Lernmaterialien
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 mb-4">
                Greife auf deine Videolektionen, Ressourcen zu und verfolge deinen Fortschritt im Programm.
              </p>
              {canAccessContent && programStarted ? (
                <a 
                  href={process.env.NEXT_PUBLIC_WHOP_COURSE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center w-full px-4 py-2 bg-black text-white rounded-md hover:bg-gray-800 transition-colors gap-2"
                >
                  Zur Kursplattform
                </a>
              ) : (
                <Button 
                  className="w-full bg-black hover:bg-black cursor-not-allowed opacity-60"
                  disabled
                >
                  Verfügbar ab 1. März 2025
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Subscription Management */}
          <Card className="md:col-span-2">
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
                    Dein Abonnement wurde gekündigt. Erneuere jetzt dein Abonnement, um deinen Platz für das Programm ab 1. März 2025 zu sichern.
                  </p>
                ) : (
                  <>
                    <p>Dein Abonnement startet am 1. März 2025.</p>
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