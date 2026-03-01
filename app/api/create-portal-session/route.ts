import { auth, currentUser } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createCustomerPortalSession } from '@/lib/stripe'
import { prisma } from '@/lib/prisma'

/**
 * PayPal-Subscription-Verwaltungsseite.
 * Wir leiten auf die allgemeine Autopay-Seite weiter, da PayPal keine direkten Deep-Links
 * zu einzelnen Subscriptions für externe Apps erlaubt.
 */
const PAYPAL_MANAGE_URL = 'https://www.paypal.com/myaccount/autopay/'

async function getPayPalSubscriptionId(userId: string): Promise<string | null> {
  try {
    const sub = await prisma.payPalSubscriber.findUnique({
      where: { userId },
      select: { paypalSubscriptionId: true, status: true },
    })

    if (sub?.status === 'ACTIVE') {
      return sub.paypalSubscriptionId
    }
  } catch {
    // non-critical
  }
  return null
}

export async function POST() {
  try {
    const { userId } = await auth()
    const user = await currentUser()

    if (!userId) {
      return NextResponse.json(
        { message: 'Nicht autorisiert' },
        { status: 401 }
      )
    }

    // PayPal-User haben kein Stripe Customer Portal.
    // Wir leiten sie direkt zur PayPal-Abo-Verwaltung weiter.
    const paypalSubscriptionId = await getPayPalSubscriptionId(userId)
    if (paypalSubscriptionId) {
      return NextResponse.json({ url: PAYPAL_MANAGE_URL, provider: 'paypal' })
    }

    const primaryEmail =
      user?.emailAddresses.find((email) => email.id === user.primaryEmailAddressId)
        ?.emailAddress ?? null

    const { url } = await createCustomerPortalSession(userId, primaryEmail)

    if (!url) {
      return NextResponse.json(
        { message: 'Fehler beim Erstellen der Portal-Session' },
        { status: 500 }
      )
    }

    return NextResponse.json({ url, provider: 'stripe' })
  } catch (error) {
    console.error('Error in create-portal-session:', error)
    return NextResponse.json(
      { message: 'Ein Fehler ist aufgetreten' },
      { status: 500 }
    )
  }
}
