// src/app/api/create-checkout/route.ts
import { auth, currentUser } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { getVerifiedPrimaryEmail } from '@/lib/clerk-email'
import { createCheckoutSession } from '@/lib/stripe'

export async function POST() {
  try {
    const { userId } = await auth()

    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    const user = await currentUser()
    if (!user) {
      return new NextResponse('Unauthorized', { status: 401 })
    }
    const primaryEmail = getVerifiedPrimaryEmail(user)

    if (!primaryEmail) {
      return new NextResponse('Verified primary email required', { status: 400 })
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
