// src/app/(dashboard)/dashboard/page.tsx
import { auth, currentUser } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { getSubscriptionSnapshot } from '@/lib/stripe'
import { isMentorshipAccessible } from '@/lib/authz'
import { getVerifiedPrimaryEmail } from '@/lib/clerk-email'
import {
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
  const showCoursesPaywall = resolvedParams?.paywall === 'courses'
  const showMentorshipNotStarted = resolvedParams?.message === 'mentorship-not-started'
  const checkForRecentCheckout = showCheckoutSuccess
  const retryCount = checkForRecentCheckout ? 5 : 3

  let firstName = getFirstNameFromSessionClaims(sessionClaims)
  const fallbackUser = await currentUser()
  if (!fallbackUser) {
    redirect('/sign-in')
  }
  const verifiedEmail = getVerifiedPrimaryEmail(fallbackUser)
  firstName = firstName ?? fallbackUser.firstName

  const snapshotPromise = getSubscriptionSnapshot(userId, {
    retryCount,
    checkForRecentCheckout,
    verifiedEmail: verifiedEmail ?? undefined,
  })

  if (!firstName) {
    firstName = fallbackUser.firstName
  }

  let snapshot = await snapshotPromise
  if (isMentorshipAccessOverrideEmail(verifiedEmail)) {
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

  if (!initialData.subscriptionDetails) {
    return (
      <DashboardConversionClient
        firstName={firstName}
        viewFlags={{
          showCheckoutSuccess,
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
      viewFlags={{
        showCheckoutSuccess,
        showCoursesPaywall,
      }}
    />
  )
}
