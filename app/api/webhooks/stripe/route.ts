import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import type Stripe from 'stripe'

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!

export async function POST(req: Request) {
  try {
    const body = await req.text()
    const headersList = headers()
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

    console.log(`Received webhook event: ${event.type}`)

    switch (event.type) {
      case 'customer.subscription.created':
        const subscriptionCreated = event.data.object as Stripe.Subscription
        console.log('New subscription created:', subscriptionCreated.id)
        // Handle new subscription
        break

      case 'customer.subscription.updated':
        const subscriptionUpdated = event.data.object as Stripe.Subscription
        console.log('Subscription updated:', subscriptionUpdated.id)
        // Handle subscription update
        break

      case 'customer.subscription.deleted':
        const subscriptionDeleted = event.data.object as Stripe.Subscription
        console.log('Subscription cancelled:', subscriptionDeleted.id)
        // Handle subscription cancellation
        break

      case 'checkout.session.completed':
        const checkoutSession = event.data.object as Stripe.Checkout.Session
        console.log('Checkout completed:', checkoutSession.id)
        // Handle successful checkout
        break

      // Add other webhook events as needed
    }

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

// This ensures the API route can accept the raw body
export const config = {
  api: {
    bodyParser: false,
  },
}