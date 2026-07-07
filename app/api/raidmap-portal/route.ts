// Billing-Portal fuer PAT-Raid-Map-Abos (separater Stripe-Customer, USD)
import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createRaidMapPortalSession } from '@/lib/stripe'

export async function POST() {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    const { url } = await createRaidMapPortalSession(userId)
    return NextResponse.json({ url })
  } catch (error) {
    console.error('Error in raidmap-portal:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    if (message.includes('No Raid Map customer')) {
      return NextResponse.json(
        { message: 'No Raid Map subscription found for this account yet.' },
        { status: 404 }
      )
    }
    return NextResponse.json({ message: 'Error creating portal session' }, { status: 500 })
  }
}
