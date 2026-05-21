import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getPayPalSubscription } from '@/lib/paypal'
import { requireAdminApiAccess } from '@/lib/authz'

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
    const admin = await requireAdminApiAccess()
    if (!admin.ok) {
      return admin.response
    }

    const body = await req.json()
    const subscriptionIds: string[] = body.subscriptionIds

    if (!Array.isArray(subscriptionIds) || subscriptionIds.length === 0) {
      return NextResponse.json(
        { error: 'subscriptionIds muss ein nicht-leeres Array sein' },
        { status: 400 }
      )
    }

    const normalizedIds = subscriptionIds
      .map((subId) => (typeof subId === 'string' ? subId.trim() : ''))
      .filter(Boolean)
    const uniqueIds = Array.from(new Set(normalizedIds))
    const existingRows = uniqueIds.length > 0
      ? await prisma.payPalSubscriber.findMany({
          where: { paypalSubscriptionId: { in: uniqueIds } },
          select: {
            paypalSubscriptionId: true,
            paypalEmail: true,
            status: true,
          },
        })
      : []
    const importedBySubscriptionId = new Map(
      existingRows.map((row) => [row.paypalSubscriptionId, row])
    )

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

    for (const trimmedId of normalizedIds) {
      try {
        // Pruefen ob schon importiert. Die Map enthaelt DB-Treffer und IDs,
        // die in diesem Request bereits erfolgreich angelegt wurden.
        const existing = importedBySubscriptionId.get(trimmedId)

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
          select: { id: true },
        })
        importedBySubscriptionId.set(info.id, {
          paypalSubscriptionId: info.id,
          paypalEmail: info.subscriberEmail,
          status: info.status,
        })
        if (info.id !== trimmedId) {
          importedBySubscriptionId.set(trimmedId, {
            paypalSubscriptionId: info.id,
            paypalEmail: info.subscriberEmail,
            status: info.status,
          })
        }

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
