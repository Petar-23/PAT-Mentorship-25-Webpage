// src/app/api/create-checkout/route.ts
import { auth, currentUser } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { getEmailFromSessionClaims } from '@/lib/clerk-claims'
import {
  createCheckoutSession,
  findBlockingMentorshipSubscription,
  getSubscriptionSnapshot,
} from '@/lib/stripe'

const PAYMENT_DUE_STATUSES = new Set(['past_due', 'unpaid'])

function checkoutConflictMessage(status: string) {
  if (PAYMENT_DUE_STATUSES.has(status)) {
    return 'Für dein Abo ist noch eine Zahlung offen. Lade die Seite neu und begleiche die offene Rechnung im Kundenportal.'
  }
  if (status === 'incomplete') {
    return 'Deine Zahlung wird noch verarbeitet. Lade die Seite neu, um deinen aktuellen Stand zu sehen, und starte bitte keinen zweiten Checkout.'
  }
  return 'Für dein Konto läuft bereits ein Mentorship-Abo. Lade die Seite neu, um deinen aktuellen Stand zu sehen.'
}

export async function POST() {
  try {
    const { userId, sessionClaims } = await auth()

    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    let primaryEmail = getEmailFromSessionClaims(sessionClaims)
    if (!primaryEmail) {
      const user = await currentUser()

      if (!user) {
        return new NextResponse('Unauthorized', { status: 401 })
      }

      primaryEmail =
        user.primaryEmailAddress?.emailAddress ??
        user.emailAddresses.find((email) => email.id === user.primaryEmailAddressId)
          ?.emailAddress ??
        null
    }

    if (!primaryEmail) {
      return new NextResponse('No email address found', { status: 400 })
    }

    // Doppelkauf-Schutz: Kein zweites Abo, solange eines läuft, offen ist oder die Erstzahlung verarbeitet wird.
    const blocking = await findBlockingMentorshipSubscription(userId)
    if (blocking) {
      // DB-Cache nachziehen, damit das Dashboard nach dem Neuladen die passende Ansicht zeigt.
      await getSubscriptionSnapshot(userId, {
        retryCount: 1,
        checkForRecentCheckout: true,
        email: primaryEmail,
      }).catch((error) => console.error('Error refreshing subscription after checkout guard:', error))

      return NextResponse.json(
        {
          code: 'subscription_exists',
          status: blocking.status,
          message: checkoutConflictMessage(blocking.status),
        },
        { status: 409 }
      )
    }

    const { url } = await createCheckoutSession(userId, primaryEmail)

    if (!url) {
      return new NextResponse('Error creating checkout session', { status: 500 })
    }

    return NextResponse.json({ url })
  } catch (error) {
    console.error('Error in create-checkout:', error)
    // Add more detailed error logging
    if (error instanceof Error) {
      console.error('Error details:', error.message)
    }
    return new NextResponse(
      'Error creating checkout session', 
      { 
        status: 500,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    )
  }
}

export const dynamic = 'force-dynamic'
