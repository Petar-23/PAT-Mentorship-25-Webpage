// src/app/api/webhooks/stripe/route.ts
import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { handleStripeEvent } from '@/lib/stripe-webhook-handler'
import type Stripe from 'stripe'

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!

export async function POST(req: Request) {
  try {
    const body = await req.text()
    const headersList = await headers()
    const signature = headersList.get('stripe-signature')

    if (!signature) {
      return new NextResponse('Missing stripe signature', { status: 400 })
    }

    let event: Stripe.Event

    try {
      event = stripe.webhooks.constructEvent(
        body,
        signature,
        webhookSecret
      )
    } catch (err) {
      console.error('Error verifying webhook signature:', err)
      return new NextResponse(
        `Webhook signature verification failed: ${err instanceof Error ? err.message : 'Unknown Error'}`,
        { status: 400 }
      )
    }

    // Handle the event
    await handleStripeEvent(event)

    return new NextResponse(JSON.stringify({ received: true }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    })
  } catch (error) {
    console.error('Error in stripe webhook:', error)
    return new NextResponse(
      `Webhook error: ${error instanceof Error ? error.message : 'Unknown Error'}`,
      { status: 400 }
    )
  }
}

export const runtime = 'edge'
export const dynamic = 'force-dynamic'