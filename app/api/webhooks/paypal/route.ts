import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyPayPalWebhookSignature } from '@/lib/paypal'
import { sendDiscordChannelMessage } from '@/lib/discord'
import {
  enqueueEntitlementRevocation,
  markEntitlementDesiredActive,
  processEntitlementRevocationQueue,
  restoreLinkedDiscordMentorshipRole,
} from '@/lib/entitlement-revocations'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type PayPalWebhookEvent = {
  id: string
  event_type: string
  resource: {
    id: string // Subscription ID
    status?: string
    subscriber?: {
      email_address?: string
    }
  }
}

export async function POST(req: Request) {
  console.log('Received PayPal webhook request')

  try {
    const body = await req.text()
    const headersList = await headers()

    const webhookId = process.env.PAYPAL_WEBHOOK_ID
    if (!webhookId) {
      console.error('Missing PAYPAL_WEBHOOK_ID')
      return new NextResponse('Server configuration error', { status: 500 })
    }

    // Webhook-Signatur verifizieren
    const paypalHeaders: Record<string, string> = {}
    const relevantHeaders = [
      'paypal-auth-algo',
      'paypal-cert-url',
      'paypal-transmission-id',
      'paypal-transmission-sig',
      'paypal-transmission-time',
    ]
    for (const name of relevantHeaders) {
      const value = headersList.get(name)
      if (value) paypalHeaders[name] = value
    }

    const verified = await verifyPayPalWebhookSignature({
      webhookId,
      headers: paypalHeaders,
      body,
    })

    if (!verified) {
      console.error('PayPal webhook signature verification failed')
      return new NextResponse('Signature verification failed', { status: 400 })
    }

    const event: PayPalWebhookEvent = JSON.parse(body)
    console.log('PayPal webhook event:', event.event_type, event.resource?.id)

    await handlePayPalEvent(event)

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Error in PayPal webhook:', error)
    return new NextResponse('Webhook processing failed', { status: 400 })
  }
}

async function handlePayPalEvent(event: PayPalWebhookEvent) {
  const subscriptionId = event.resource?.id
  if (!subscriptionId) {
    console.log('PayPal webhook: no subscription ID in resource')
    return
  }

  switch (event.event_type) {
    case 'BILLING.SUBSCRIPTION.CANCELLED':
    case 'BILLING.SUBSCRIPTION.SUSPENDED':
    case 'BILLING.SUBSCRIPTION.EXPIRED': {
      const newStatus = event.resource.status ?? event.event_type.split('.').pop() ?? 'CANCELLED'
      await handleSubscriptionEnd(subscriptionId, newStatus)
      break
    }

    case 'BILLING.SUBSCRIPTION.ACTIVATED':
    case 'BILLING.SUBSCRIPTION.RE-ACTIVATED': {
      await handleSubscriptionActivated(subscriptionId)
      break
    }

    default:
      console.log(`Unhandled PayPal event type: ${event.event_type}`)
  }
}

async function handleSubscriptionEnd(subscriptionId: string, newStatus: string) {
  const subscriber = await prisma.payPalSubscriber.findUnique({
    where: { paypalSubscriptionId: subscriptionId },
  })

  if (!subscriber) {
    console.log(`PayPal subscriber not found: ${subscriptionId}`)
    return
  }

  // Status updaten
  await prisma.payPalSubscriber.update({
    where: { id: subscriber.id },
    data: { status: newStatus },
  })

  // Falls User verknuepft: UserSubscription updaten
  if (subscriber.userId) {
    await prisma.userSubscription.updateMany({
      where: {
        userId: subscriber.userId,
        paypalSubscriptionId: subscriptionId,
      },
      data: { status: 'canceled' },
    })

    // Durable revoke: the worker re-checks Stripe/Admin immediately before
    // removing anything, so an alternative active provider wins.
    const job = await enqueueEntitlementRevocation({
      userId: subscriber.userId,
      entitlement: 'mentorship',
      reason: `paypal:${newStatus}`,
    })
    await processEntitlementRevocationQueue({
      limit: 1,
      jobId: job.id,
      workerId: 'paypal-webhook',
    })
  }

  // Mod-Benachrichtigung
  await safeSendModNotification({
    title: 'PayPal-Abo beendet',
    description: `PayPal-Subscription ${subscriptionId} wurde beendet (${newStatus}).`,
    email: subscriber.paypalEmail,
    color: 0xef4444,
  })
}

async function handleSubscriptionActivated(subscriptionId: string) {
  const subscriber = await prisma.payPalSubscriber.findUnique({
    where: { paypalSubscriptionId: subscriptionId },
  })

  if (!subscriber) {
    console.log(`PayPal subscriber not found for activation: ${subscriptionId}`)
    return
  }

  await prisma.payPalSubscriber.update({
    where: { id: subscriber.id },
    data: { status: 'ACTIVE' },
  })

  if (subscriber.userId) {
    await prisma.userSubscription.updateMany({
      where: {
        userId: subscriber.userId,
        paypalSubscriptionId: subscriptionId,
      },
      data: { status: 'active' },
    })
    await markEntitlementDesiredActive({
      userId: subscriber.userId,
      entitlement: 'mentorship',
      reason: 'paypal:ACTIVE',
    })
    await restoreLinkedDiscordMentorshipRole(subscriber.userId)
  }
}

async function safeSendModNotification(params: {
  title: string
  description: string
  email: string
  color: number
}) {
  const channelId = process.env.DISCORD_MOD_CHANNEL_ID
  if (!channelId) return

  try {
    await sendDiscordChannelMessage({
      channelId,
      content: '',
      embeds: [
        {
          title: params.title,
          description: params.description,
          color: params.color,
          fields: [
            { name: 'PayPal Email', value: params.email, inline: true },
          ],
          footer: { text: 'Price Action Trader Mentorship' },
          timestamp: new Date().toISOString(),
        },
      ],
    })
  } catch (err) {
    console.error('Failed to send PayPal mod notification:', err)
  }
}
