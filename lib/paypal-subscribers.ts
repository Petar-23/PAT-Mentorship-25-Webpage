import 'server-only'

import { prisma } from '@/lib/prisma'

export type PayPalSubscriberListItem = {
  id: string
  paypalSubscriptionId: string
  paypalEmail: string
  status: string
  userId: string | null
  claimedAt: string | null
  createdAt: string
}

export async function listPayPalSubscribers(): Promise<PayPalSubscriberListItem[]> {
  const subscribers = await prisma.payPalSubscriber.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      paypalSubscriptionId: true,
      paypalEmail: true,
      status: true,
      userId: true,
      claimedAt: true,
      createdAt: true,
    },
  })

  return subscribers.map((sub) => ({
    ...sub,
    claimedAt: sub.claimedAt?.toISOString() ?? null,
    createdAt: sub.createdAt.toISOString(),
  }))
}
