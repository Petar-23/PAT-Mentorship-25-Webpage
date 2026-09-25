// src/app/(dashboard)/dashboard/page.tsx
import { auth, currentUser } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { getSubscriptionSnapshot } from '@/lib/stripe'
import { getIsAdmin, isMentorshipAccessible } from '@/lib/authz'
import { decideDashboardView } from '@/lib/checkout-eligibility.mjs'
import {
  getEmailFromSessionClaims,
  getFirstNameFromSessionClaims,
} from '@/lib/clerk-claims'
import { isMentorshipAccessOverrideEmail } from '@/lib/mentorship-access-overrides'
import DashboardConversionClient from './dashboard-conversion-client'
import DashboardMemberClient from './dashboard-member-client'

// We need to match Next.js's exact type expectation
interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }> | undefined
}

export default async function DashboardPage({
  searchParams = Promise.resolve({})  // Provide a default value that matches the type
}: PageProps) {
  const authPromise = auth()
  const resolvedParamsPromise = searchParams
  const [{ userId, sessionClaims }, resolvedParams] = await Promise.all([
    authPromise,
    resolvedParamsPromise,
  ])
  
  if (!userId) {
    redirect('/sign-in')
  }

  const showCheckoutSuccess = resolvedParams?.success === 'true'
  // Rücksprung aus dem Gast-Checkout über /willkommen: Freischaltung ist schon geschrieben, das
  // purchase-Event hat /willkommen gesendet. Hier nur Erfolgsansicht, ohne zweites Tracking.
  const showWelcome = resolvedParams?.willkommen === '1'
  const showCheckoutCanceled = resolvedParams?.canceled === 'true'
  const showCoursesPaywall = resolvedParams?.paywall === 'courses'
  const showMentorshipNotStarted = resolvedParams?.message === 'mentorship-not-started'
  const checkForRecentCheckout = showCheckoutSuccess || showWelcome
  const retryCount = checkForRecentCheckout ? 5 : 3

  let email = getEmailFromSessionClaims(sessionClaims)
  let firstName = getFirstNameFromSessionClaims(sessionClaims)
  let fallbackUser: Awaited<ReturnType<typeof currentUser>> | null = null

  if (!email) {
    // If the token has no email, resolve Clerk first so the Stripe fallback runs once
    // with the best identifier instead of doing a second subscription lookup later.
    fallbackUser = await currentUser()
    if (!fallbackUser) {
      redirect('/sign-in')
    }

    const user = fallbackUser
    email =
      user.primaryEmailAddress?.emailAddress ??
      user.emailAddresses.find((address) => address.id === user.primaryEmailAddressId)?.emailAddress ??
      null
    firstName = firstName ?? user.firstName
  }

  const snapshotPromise = getSubscriptionSnapshot(userId, {
    retryCount,
    checkForRecentCheckout,
    email: email ?? undefined,
  })

  if (!firstName) {
    fallbackUser = fallbackUser ?? (await currentUser())
    if (!fallbackUser) {
      redirect('/sign-in')
    }

    firstName = fallbackUser.firstName
  }

  let snapshot = await snapshotPromise

  // DB-Cache sagt active/trialing, aber das Periodenende ist vorbei: Meist fehlt nur der Webhook der
  // Verlängerung. Bevor ein zahlendes Mitglied „Abo beendet“ und den Checkout sieht, einmal frisch bei
  // Stripe nachfragen (aktualisiert auch den Cache). Selten, deshalb kein Dauerkostenfaktor.
  if (
    !checkForRecentCheckout &&
    !isMentorshipAccessOverrideEmail(email) &&
    decideDashboardView({
      hasActiveSubscription: snapshot.hasActiveSubscription,
      subscriptionDetails: snapshot.subscriptionDetails,
    }).reason === 'period-ended'
  ) {
    snapshot = await getSubscriptionSnapshot(userId, {
      retryCount: 1,
      checkForRecentCheckout: true,
      email: email ?? undefined,
    })
  }

  if (isMentorshipAccessOverrideEmail(email)) {
    snapshot = {
      hasActiveSubscription: true,
      subscriptionDetails: {
        status: 'active',
        startDate: process.env.MENTORSHIP_START_DATE || '2026-03-01T00:00:00+01:00',
        isPending: false,
        isCanceled: false,
        cancelAt: null,
        currentPeriodEnd: null,
      },
    }
  }

  const initialData = {
    hasSubscription: snapshot.hasActiveSubscription,
    subscriptionDetails: snapshot.subscriptionDetails,
    mentorshipStatus: {
      accessible: isMentorshipAccessible(),
      startDate: process.env.MENTORSHIP_START_DATE || '2026-03-01T00:00:00+01:00',
    },
    user: {
      firstName
    }
  }

  // Weiche nach Abo-Status (lib/checkout-eligibility.mjs): Ex-Mitglieder (canceled, incomplete_expired,
  // abgelaufene Periode) dürfen neu buchen; past_due/unpaid/incomplete bleiben ohne zweiten Checkout.
  let decision = decideDashboardView({
    hasActiveSubscription: initialData.hasSubscription,
    subscriptionDetails: initialData.subscriptionDetails,
  })

  // Nur wenn sich die Ansicht gegenüber früher ändern würde (Abo-Daten vorhanden, aber Checkout),
  // fragen wir den Admin-Status ab. Admins behalten die Mitgliederansicht; im Fehlerfall ebenso.
  if (decision.view === 'checkout' && initialData.subscriptionDetails) {
    const isAdmin = await getIsAdmin(userId, sessionClaims).catch((error) => {
      console.error('Error checking admin status for dashboard view:', error)
      return true
    })
    decision = decideDashboardView({
      hasActiveSubscription: initialData.hasSubscription,
      subscriptionDetails: initialData.subscriptionDetails,
      isAdmin,
    })
  }

  if (decision.view === 'checkout' || !initialData.subscriptionDetails) {
    const previousSubscription =
      decision.reason === 'payment-expired'
        ? 'payment-expired'
        : decision.reason === 'subscription-ended' || decision.reason === 'period-ended'
          ? 'ended'
          : null

    return (
      <DashboardConversionClient
        firstName={firstName}
        previousSubscription={previousSubscription}
        viewFlags={{
          showCheckoutSuccess: checkForRecentCheckout,
          showCheckoutCanceled,
          showCoursesPaywall,
          showMentorshipNotStarted,
        }}
      />
    )
  }

  return (
    <DashboardMemberClient
      initialData={{
        ...initialData,
        subscriptionDetails: initialData.subscriptionDetails,
      }}
      notice={decision.notice}
      viewFlags={{
        showCheckoutSuccess: showCheckoutSuccess && initialData.hasSubscription,
        showWelcome: showWelcome && initialData.hasSubscription,
        showCoursesPaywall,
      }}
    />
  )
}
