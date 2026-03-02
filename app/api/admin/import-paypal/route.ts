import { auth, clerkClient } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getPayPalSubscription } from '@/lib/paypal'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Admin-Endpoint: Importiert PayPal Subscription IDs und prueft deren Status.
 *
 * POST /api/admin/import-paypal
 * Body: { subscriptionIds: string[] }
 *
 * Fuer jede Subscription ID:
 * 1. Ruft PayPal API ab → Status + Subscriber-Email
 * 2. Speichert in PayPalSubscriber Tabelle
 * 3. Report zurueckgeben
 */
export async function POST(req: Request) {
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

    const body = await req.json()
    const subscriptionIds: string[] = body.subscriptionIds

    if (!Array.isArray(subscriptionIds) || subscriptionIds.length === 0) {
      return NextResponse.json(
        { error: 'subscriptionIds muss ein nicht-leeres Array sein' },
        { status: 400 }
      )
    }

    const results = {
      total: subscriptionIds.length,
      imported: 0,
      active: 0,
      inactive: 0,
      alreadyExists: 0,
      errors: [] as string[],
      details: [] as Array<{
        subscriptionId: string
        email: string
        status: string
        name: string | null
      }>,
    }

    for (const subId of subscriptionIds) {
      const trimmedId = subId.trim()
      if (!trimmedId) continue

      try {
        // Pruefen ob schon importiert
        const existing = await prisma.payPalSubscriber.findUnique({
          where: { paypalSubscriptionId: trimmedId },
        })

        if (existing) {
          results.alreadyExists++
          results.details.push({
            subscriptionId: trimmedId,
            email: existing.paypalEmail,
            status: existing.status,
            name: null,
          })
          continue
        }

        // PayPal API abrufen
        const info = await getPayPalSubscription(trimmedId)

        // In DB speichern
        await prisma.payPalSubscriber.create({
          data: {
            paypalSubscriptionId: info.id,
            paypalEmail: info.subscriberEmail,
            status: info.status,
          },
        })

        results.imported++
        if (info.status === 'ACTIVE') {
          results.active++
        } else {
          results.inactive++
        }

        results.details.push({
          subscriptionId: info.id,
          email: info.subscriberEmail,
          status: info.status,
          name: info.subscriberName,
        })
      } catch (err) {
        results.errors.push(
          `${trimmedId}: ${err instanceof Error ? err.message : 'Unbekannter Fehler'}`
        )
      }
    }

    return NextResponse.json(results)
  } catch (error) {
    console.error('PayPal import error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    )
  }
}
