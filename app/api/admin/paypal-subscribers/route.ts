import { clerkClient } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminApiAccess } from '@/lib/authz'
import { listPayPalSubscribers } from '@/lib/paypal-subscribers'

export const dynamic = 'force-dynamic'

/**
 * Admin-Endpoint: Gibt alle importierten PayPal-Subscriber zurueck.
 *
 * GET /api/admin/paypal-subscribers
 */
export async function GET() {
  try {
    const access = await requireAdminApiAccess()
    if (!access.ok) return access.response

    const subscribers = await listPayPalSubscribers()
    return NextResponse.json({ subscribers })
  } catch (error) {
    console.error('PayPal subscribers list error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    )
  }
}

/**
 * Admin-Endpoint: PayPal-Subscriber bearbeiten (User zuweisen, Email/Status aendern).
 *
 * PATCH /api/admin/paypal-subscribers
 * Body: { id: string, userId?: string | null, paypalEmail?: string, status?: string }
 */
export async function PATCH(req: NextRequest) {
  try {
    const access = await requireAdminApiAccess()
    if (!access.ok) return access.response

    const body = await req.json()
    const { id, userId, paypalEmail, status } = body as {
      id: string
      userId?: string | null
      paypalEmail?: string
      status?: string
    }

    if (!id) {
      return NextResponse.json({ error: 'Missing subscriber id' }, { status: 400 })
    }

    const existing = await prisma.payPalSubscriber.findUnique({
      where: { id },
      select: { id: true, paypalSubscriptionId: true },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Subscriber not found' }, { status: 404 })
    }

    // Build update data — only include fields that were provided
    const updateData: Record<string, unknown> = {}

    if (userId !== undefined) {
      // If assigning a user, verify they exist in Clerk
      if (userId) {
        try {
          const client = await clerkClient()
          await client.users.getUser(userId)
        } catch {
          return NextResponse.json(
            { error: `Clerk user '${userId}' not found` },
            { status: 400 }
          )
        }

        // Check if this userId is already assigned to another subscriber
        const existingAssignment = await prisma.payPalSubscriber.findUnique({
          where: { userId },
          select: { id: true, paypalSubscriptionId: true },
        })
        if (existingAssignment && existingAssignment.id !== id) {
          return NextResponse.json(
            {
              error: `User is already assigned to another PayPal subscription (${existingAssignment.paypalSubscriptionId})`,
            },
            { status: 409 }
          )
        }
      }

      updateData.userId = userId || null
      updateData.claimedAt = userId ? new Date() : null
    }

    if (paypalEmail !== undefined) {
      updateData.paypalEmail = paypalEmail
    }

    if (status !== undefined) {
      updateData.status = status
    }

    const updated = await prisma.payPalSubscriber.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        paypalSubscriptionId: true,
        paypalEmail: true,
        status: true,
        userId: true,
        claimedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    // If a userId was assigned, also update UserSubscription
    if (userId && updateData.userId) {
      await prisma.userSubscription.upsert({
        where: { userId },
        create: {
          userId,
          paypalSubscriptionId: existing.paypalSubscriptionId,
          status: 'active',
        },
        update: {
          paypalSubscriptionId: existing.paypalSubscriptionId,
          status: 'active',
        },
        select: { id: true },
      })
    }

    return NextResponse.json({ subscriber: updated })
  } catch (error) {
    console.error('PayPal subscriber update error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    )
  }
}
