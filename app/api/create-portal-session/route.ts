// src/app/api/create-portal-session/route.ts
import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createCustomerPortalSession } from '@/lib/stripe'

export async function POST() {
  try {
    const { userId } = await auth()

    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    const { url } = await createCustomerPortalSession(userId)

    return NextResponse.json({ url })
  } catch (error) {
    console.error('Error in create-portal-session:', error)
    return new NextResponse(
      'Error creating portal session', 
      { status: 500 }
    )
  }
}