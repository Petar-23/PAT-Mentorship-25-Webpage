import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { handleStripeEvent } from '@/lib/stripe-webhook-handler'
import type Stripe from 'stripe'

export async function POST(req: Request) {
  console.log('Received webhook request')
  try {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
    if (!webhookSecret) {
      console.error('Missing STRIPE_WEBHOOK_SECRET')
      return new NextResponse('Webhook secret not configured', { status: 500 })
    }

    const body = await req.text()
    const headersList = await headers()
    const signature = headersList.get('stripe-signature')

    if (!signature) {
      console.log('Missing stripe signature')
      return new NextResponse('Missing stripe signature', { status: 400 })
    }

    let event: Stripe.Event

    try {
      event = await stripe.webhooks.constructEventAsync(
        body,
        signature,
        webhookSecret
      )
      console.log('Successfully constructed event:', event.type)
    } catch (err) {
      console.error('Error verifying webhook signature:', err)
      return new NextResponse('Webhook signature verification failed', { status: 400 })
    }

    // Handle the event
    await handleStripeEvent(event)
    console.log('Successfully handled event')

    return new NextResponse(JSON.stringify({ received: true }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    })
  } catch (error) {
    console.error('Error in stripe webhook:', error)
    return new NextResponse('Webhook processing failed', { status: 400 })
  }
}

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
