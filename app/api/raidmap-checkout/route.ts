// Checkout für PAT Raid Map (Einzelprodukt, monthly/annual)
import { auth, currentUser } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { getEmailFromSessionClaims } from '@/lib/clerk-claims'
import { RAIDMAP_CONFIG, type RaidMapLang } from '@/lib/raidmap-config'
import { isRaidMapTestMode } from '@/lib/raidmap-test-mode'
import { createRaidMapCheckoutSession, type RaidMapCheckoutTier } from '@/lib/stripe'

function isTier(value: unknown): value is RaidMapCheckoutTier {
  return value === 'monthly' || value === 'annual'
}

function isLang(value: unknown): value is RaidMapLang {
  return value === 'en' || value === 'de'
}

export async function POST(request: Request) {
  let tier: RaidMapCheckoutTier = 'monthly'
  let lang: RaidMapLang = 'en'
  try {
    const body = await request.json()
    if (isTier(body?.tier)) tier = body.tier
    if (isLang(body?.lang)) lang = body.lang
  } catch {
    // Invalid/missing body uses the established monthly/English defaults.
  }

  // Dev-only Test-Mode: Checkout simulieren, Clerk/Stripe werden nicht angefasst
  // (doppelt geguarded in lib/raidmap-test-mode.ts, in Production immer aus).
  if (isRaidMapTestMode()) {
    const salesPath = lang === 'de' ? RAIDMAP_CONFIG.salesPathDe : RAIDMAP_CONFIG.salesPathEn
    return NextResponse.json({ url: `${salesPath}?checkout=success&test=1` })
  }

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

    const { url } = await createRaidMapCheckoutSession(userId, primaryEmail, tier, lang)

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
