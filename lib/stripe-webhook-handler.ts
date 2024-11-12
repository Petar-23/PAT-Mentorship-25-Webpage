// src/lib/stripe-webhook-handler.ts
import type Stripe from 'stripe'

export async function handleStripeEvent(event: Stripe.Event) {
  try {
    switch (event.type) {
      case 'customer.subscription.created':
        await handleSubscriptionCreated(event.data.object as Stripe.Subscription)
        break

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription)
        break

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription)
        break

      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session)
        break

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }
  } catch (error) {
    console.error('Error handling Stripe event:', error)
    throw error
  }
}

async function handleSubscriptionCreated(subscription: Stripe.Subscription) {
  console.log('New subscription created:', subscription.id)
  // Add your subscription creation logic here
  // e.g., update database, send welcome email, etc.
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  console.log('Subscription updated:', subscription.id)
  // Add your subscription update logic here
  // e.g., update database with new status, send notification, etc.
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  console.log('Subscription cancelled:', subscription.id)
  // Add your subscription deletion logic here
  // e.g., update database, send cancellation email, etc.
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  console.log('Checkout completed:', session.id)
  // Add your checkout completion logic here
  // e.g., create user record, send welcome email, etc.
}