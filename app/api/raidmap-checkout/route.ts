// Checkout für PAT Raid Map (Einzelprodukt, monthly/annual)
import { auth, currentUser } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { getVerifiedPrimaryEmail } from '@/lib/clerk-email'
import { RAIDMAP_CONFIG } from '@/lib/raidmap-config'
import { isRaidMapTestMode } from '@/lib/raidmap-test-mode'
import { createRaidMapCheckoutSession, type RaidMapCheckoutTier } from '@/lib/stripe'

function isTier(value: unknown): value is RaidMapCheckoutTier {
  return value === 'monthly' || value === 'annual'
}

export async function POST(request: Request) {
  // Dev-only Test-Mode: Checkout simulieren, Clerk/Stripe werden nicht angefasst
  // (doppelt geguarded in lib/raidmap-test-mode.ts, in Production immer aus).
  if (isRaidMapTestMode()) {
    return NextResponse.json({ url: `${RAIDMAP_CONFIG.salesPathEn}?checkout=success&test=1` })
  }

  try {
    const { userId } = await auth()

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

    const user = await currentUser()
    if (!user) {
      return new NextResponse('Unauthorized', { status: 401 })
    }
    const primaryEmail = getVerifiedPrimaryEmail(user)

    if (!primaryEmail) {
      return new NextResponse('Verified primary email required', { status: 400 })
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
