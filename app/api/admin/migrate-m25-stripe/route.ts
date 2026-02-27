import { auth, clerkClient } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const M25_PRICE_ID = 'price_1QNjN2I298HTtkSKnHPKgskR'

/**
 * Admin-Endpoint: Verknuepft M25 Stripe-Kunden mit Clerk-Accounts.
 *
 * Fuer jeden aktiven M25-Subscriber:
 * 1. Prueft ob Stripe-Customer schon metadata.userId hat
 * 2. Falls nicht: sucht Clerk-User per Email
 * 3. Falls gefunden: setzt metadata.userId + erstellt DB-Record
 *
 * GET /api/admin/migrate-m25-stripe
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

    const results = {
      total: 0,
      alreadyLinked: 0,
      linked: 0,
      noClerkUser: [] as string[],
      errors: [] as string[],
      dbRecordsCreated: 0,
    }

    // Alle aktiven + trialing M25 Subscriptions abrufen
    const statuses = ['active', 'trialing'] as const
    for (const status of statuses) {
      let hasMore = true
      let startingAfter: string | undefined

      while (hasMore) {
        const subscriptions = await stripe.subscriptions.list({
          price: M25_PRICE_ID,
          status,
          limit: 100,
          ...(startingAfter ? { starting_after: startingAfter } : {}),
        })

        for (const subscription of subscriptions.data) {
          results.total++

          const customerId =
            typeof subscription.customer === 'string'
              ? subscription.customer
              : subscription.customer?.id

          if (!customerId) {
            results.errors.push(`Subscription ${subscription.id}: kein Customer`)
            continue
          }

          try {
            const customer = await stripe.customers.retrieve(customerId)
            if ('deleted' in customer && customer.deleted) {
              results.errors.push(`Customer ${customerId}: geloescht`)
              continue
            }

            const existingUserId = customer.metadata?.userId
            if (existingUserId) {
              results.alreadyLinked++

              // DB-Record trotzdem sicherstellen
              await ensureDbRecord(existingUserId, customerId, subscription)
              continue
            }

            // Clerk-User per Email suchen
            const email = customer.email
            if (!email) {
              results.noClerkUser.push(`${customerId} (keine Email)`)
              continue
            }

            const clerkUsers = await client.users.getUserList({
              emailAddress: [email],
              limit: 1,
            })

            if (clerkUsers.data.length === 0) {
              results.noClerkUser.push(email)
              continue
            }

            const clerkUser = clerkUsers.data[0]

            // Stripe-Customer mit Clerk-User verknuepfen
            await stripe.customers.update(customerId, {
              metadata: {
                ...(customer.metadata ?? {}),
                userId: clerkUser.id,
              },
            })

            // DB-Record anlegen
            await ensureDbRecord(clerkUser.id, customerId, subscription)

            results.linked++
          } catch (err) {
            results.errors.push(
              `Customer ${customerId}: ${err instanceof Error ? err.message : 'Unbekannter Fehler'}`
            )
          }
        }

        hasMore = subscriptions.has_more
        if (subscriptions.data.length > 0) {
          startingAfter = subscriptions.data[subscriptions.data.length - 1].id
        }
      }
    }

    return NextResponse.json(results)
  } catch (error) {
    console.error('Migration error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    )
  }
}

async function ensureDbRecord(
  appUserId: string,
  stripeCustomerId: string,
  subscription: { id: string; status: string; cancel_at_period_end: boolean; current_period_end: number; cancel_at: number | null; items?: { data: Array<{ price: { id: string } | string }> } }
) {
  const priceIds = (subscription.items?.data ?? [])
    .map((item) => {
      const price = item.price
      return typeof price === 'string' ? price : price?.id
    })
    .filter((id): id is string => typeof id === 'string')

  await prisma.userSubscription.upsert({
    where: { userId: appUserId },
    create: {
      userId: appUserId,
      stripeCustomerId,
      stripeSubscriptionId: subscription.id,
      status: subscription.status,
      cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      cancelAt: subscription.cancel_at ? new Date(subscription.cancel_at * 1000) : null,
      priceIds,
    },
    update: {
      stripeCustomerId,
      stripeSubscriptionId: subscription.id,
      status: subscription.status,
      cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      cancelAt: subscription.cancel_at ? new Date(subscription.cancel_at * 1000) : null,
      priceIds,
    },
  })
}
