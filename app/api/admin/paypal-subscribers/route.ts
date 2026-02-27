import { auth, clerkClient } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * Admin-Endpoint: Gibt alle importierten PayPal-Subscriber zurueck.
 *
 * GET /api/admin/paypal-subscribers
 */
export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const client = await clerkClient()
    const memberships = await client.users.getOrganizationMembershipList({
      userId,
      limit: 100,
    })
    const isAdmin = memberships.data.some((m) => m.role === 'org:admin')
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const subscribers = await prisma.payPalSubscriber.findMany({
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ subscribers })
  } catch (error) {
    console.error('PayPal subscribers list error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    )
  }
}
