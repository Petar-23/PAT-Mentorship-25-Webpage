import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { isMentorshipAccessible } from '@/lib/authz'
import { hasActiveSubscription } from '@/lib/stripe'

export async function GET() {
  const accessible = isMentorshipAccessible()

  let hasSubscription = false
  try {
    const { userId } = await auth()
    if (userId) {
      hasSubscription = await hasActiveSubscription(userId)
    }
  } catch (error) {
    console.error('Error checking subscription status:', error)
    hasSubscription = false
  }

  return NextResponse.json({
    accessible,
    startDate: process.env.MENTORSHIP_START_DATE || '2026-03-01T00:00:00+01:00',
    hasSubscription,
  })
}

export const dynamic = 'force-dynamic'

