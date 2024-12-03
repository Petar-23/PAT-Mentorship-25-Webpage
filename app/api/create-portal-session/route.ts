// src/app/api/create-portal-session/route.ts
import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createCustomerPortalSession } from '@/lib/stripe'

export async function POST() {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json(
        { message: 'Nicht autorisiert' }, 
        { status: 401 }
      )
    }

    const { url } = await createCustomerPortalSession(userId)

    if (!url) {
      return NextResponse.json(
        { message: 'Fehler beim Erstellen der Portal-Session' }, 
        { status: 500 }
      )
    }

    return NextResponse.json({ url })
  } catch (error) {
    console.error('Error in create-portal-session:', error)
    return NextResponse.json(
      { message: 'Ein Fehler ist aufgetreten' }, 
      { status: 500 }
    )
  }
}