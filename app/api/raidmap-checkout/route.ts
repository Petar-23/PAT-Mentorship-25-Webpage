// Checkout für PAT Raid Map (Einzelprodukt, monthly/annual)
import { auth, currentUser } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { getEmailFromSessionClaims } from '@/lib/clerk-claims'
import { createRaidMapCheckoutSession, type RaidMapCheckoutTier } from '@/lib/stripe'

function isTier(value: unknown): value is RaidMapCheckoutTier {
  return value === 'monthly' || value === 'annual'
}

export async function POST(request: Request) {
  try {
    const { userId, sessionClaims } = await auth()

    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    let tier: RaidMapCheckoutTier = 'monthly'
    try {
      const body = await request.json()
      if (isTier(body?.tier)) {
        tier = body.tier
      }
    } catch {
      // kein/ungueltiger Body -> Default monthly
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

    const { url } = await createRaidMapCheckoutSession(userId, primaryEmail, tier)

    if (!url) {
      return new NextResponse('Error creating checkout session', { status: 500 })
    }

    return NextResponse.json({ url })
  } catch (error) {
    console.error('Error in raidmap-checkout:', error)
    if (error instanceof Error) {
      console.error('Error details:', error.message)
    }
    return new NextResponse('Error creating checkout session', { status: 500 })
  }
}

export const dynamic = 'force-dynamic'
