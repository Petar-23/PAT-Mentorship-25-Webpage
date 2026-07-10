'use client'

import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { BookOpen } from '@phosphor-icons/react/BookOpen'
import { CreditCard } from '@phosphor-icons/react/CreditCard'
import { LockIcon } from '@phosphor-icons/react/Lock'
import { trackConversion } from '@/components/analytics/tracking'
import { MENTORSHIP_CONFIG, MENTORSHIP_IS_UPCOMING } from '@/lib/config'

function formatMentorshipDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return MENTORSHIP_CONFIG.startDateFormatted

  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}

const ManageSubscriptionButton = dynamic(
  () => import('@/components/ui/manage-subscription').then((mod) => mod.ManageSubscriptionButton),
  {
    ssr: false,
    loading: () => (
      <Button disabled variant="outline" className="w-full">
        <CreditCard className="h-4 w-4" />
        <span>Abonnement Verwalten</span>
      </Button>
    ),
  }
)

const SubscriptionStatus = dynamic(
  () => import('@/components/dashboard/subscription-status').then((mod) => mod.SubscriptionStatus),
  {
    ssr: false,
    loading: () => (
      <Card className="bg-gray-50">
        <CardContent className="p-6 text-sm text-gray-600">
          Abo-Status wird geladen...
        </CardContent>
      </Card>
    ),
  }
)

const SubscriptionSuccessModal = dynamic(
  () => import('@/components/dashboard/subscription-success-modal').then((mod) => mod.SubscriptionSuccessModal),
  { ssr: false }
)

type SubscriptionDetails = {
  status: string
  startDate: string
  isPending: boolean
  isCanceled: boolean
  cancelAt: string | null
  currentPeriodEnd: string | null
}

type DashboardMemberClientProps = {
  initialData: {
    hasSubscription: boolean
    subscriptionDetails: SubscriptionDetails
    mentorshipStatus: {
      accessible: boolean
      startDate: string
    }
    user: {
      firstName: string | null
    }
  }
  viewFlags: {
    showCheckoutSuccess: boolean
    showCoursesPaywall: boolean
  }
}

export default function DashboardMemberClient({
  initialData,
  viewFlags,
}: DashboardMemberClientProps) {
  const { showCheckoutSuccess, showCoursesPaywall } = viewFlags
  const mentorshipStatus = initialData.mentorshipStatus
  const mentorshipStartDate = formatMentorshipDate(initialData.mentorshipStatus.startDate)
  const subscriptionStartDate = formatMentorshipDate(initialData.subscriptionDetails.startDate)
  const subscriptionEndDate = initialData.subscriptionDetails.currentPeriodEnd
    ? formatMentorshipDate(initialData.subscriptionDetails.currentPeriodEnd)
    : null
  const subscriptionIsPending =
    initialData.subscriptionDetails.isPending ||
    initialData.subscriptionDetails.status === 'incomplete'
  const hasMentorshipAccess =
    initialData.hasSubscription && mentorshipStatus?.accessible
  const [showSuccessModal, setShowSuccessModal] = useState(
    () => showCheckoutSuccess && initialData.hasSubscription
  )
  const hasTrackedPurchase = useRef(false)

  useEffect(() => {
    if (showCheckoutSuccess && initialData.hasSubscription && !hasTrackedPurchase.current) {
      hasTrackedPurchase.current = true
      trackConversion.purchase(MENTORSHIP_CONFIG.price)
      if (window.history.replaceState) {
        window.history.replaceState({}, '', '/dashboard')
      }
    }
  }, [initialData.hasSubscription, showCheckoutSuccess])

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

  return (
    <>
      {showSuccessModal && (
        <SubscriptionSuccessModal
          isOpen={true}
          hasMentorshipAccess={hasMentorshipAccess}
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
                      Dein Abo ist aktuell nicht aktiv. Bitte prüfe dein Stripe-Abo oder schließe es ab.
                    </p>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="w-full sm:w-[240px]">
                    <ManageSubscriptionButton />
                  </div>
                  <Button variant="ghost" className="w-full sm:w-auto" onClick={clearPaywallParam}>
                    Okay
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <div className="mb-8">
          <SubscriptionStatus
            startDate={initialData.subscriptionDetails.startDate}
            status={initialData.subscriptionDetails.status}
            isPending={initialData.subscriptionDetails.isPending}
            isCanceled={initialData.subscriptionDetails.isCanceled}
            cancelAt={initialData.subscriptionDetails.cancelAt}
          />
        </div>

        <div className="grid gap-6">
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-blue-600" />
                Kursinhalte & Community
              </CardTitle>
              <CardDescription>Direkt zum Mentorship-Bereich</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 mb-4">
                Hier kommst du direkt zur Discord-Verknüpfung und zum Mentorship-Bereich.
              </p>

              {!hasMentorshipAccess ? (
                <Button
                  disabled
                  className="w-full bg-blue-600 hover:bg-blue-600 opacity-60 cursor-not-allowed"
                  title={
                    !initialData.hasSubscription
                      ? 'Ein aktives Abonnement ist erforderlich.'
                      : `Mentorship startet am ${mentorshipStartDate}`
                  }
                >
                  {initialData.hasSubscription
                    ? `Zur Mentorship Platform (Startet am ${mentorshipStartDate})`
                    : 'Mentorship-Zugang nicht aktiv'}
                </Button>
              ) : (
                <Button asChild className="w-full bg-blue-600 hover:bg-blue-700">
                  <Link href="/mentorship" prefetch={false}>Zur Mentorship Platform</Link>
                </Button>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Abonnement Verwalten
              </CardTitle>
              <CardDescription>Verwalte dein Abonnement und deine Zahlungsdetails</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm text-gray-600">
                {initialData.subscriptionDetails.isCanceled ? (
                  <p className="text-red-600">
                    {initialData.hasSubscription
                      ? `Dein Abonnement ist gekündigt. Dein Zugang bleibt ${subscriptionEndDate ? `bis zum ${subscriptionEndDate}` : 'bis zum Ende der bezahlten Periode'} aktiv.`
                      : 'Dein Abonnement ist gekündigt und aktuell nicht mehr aktiv.'}
                  </p>
                ) : subscriptionIsPending ? (
                  <p className="text-amber-700">
                    Dein Abonnement wird noch verarbeitet. Sobald die Zahlung bestätigt ist, wird dein Zugang automatisch freigeschaltet.
                  </p>
                ) : !initialData.hasSubscription ? (
                  <p className="text-amber-700">
                    Dein Abonnement ist aktuell nicht aktiv (Status: {initialData.subscriptionDetails.status}). Prüfe deine Zahlung oder reaktiviere das Abo im Kundenportal.
                  </p>
                ) : (
                  <>
                    <p>
                      {MENTORSHIP_IS_UPCOMING
                        ? `Dein Abonnement startet am ${subscriptionStartDate}. Die erste Zahlung erfolgt automatisch an diesem Datum.`
                        : 'Dein Abonnement ist aktiv und dein Mentorship-Zugang kann direkt genutzt werden.'}
                    </p>
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
