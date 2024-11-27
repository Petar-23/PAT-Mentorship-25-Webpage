// src/lib/stripe.ts
import Stripe from 'stripe'

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('Missing STRIPE_SECRET_KEY')
}

if (!process.env.NEXT_PUBLIC_APP_URL) {
  throw new Error('Missing NEXT_PUBLIC_APP_URL')
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-10-28.acacia',
  typescript: true,
})

// Valid subscription statuses in Stripe

export async function hasActiveSubscription(userId: string): Promise<boolean> {
  try {
    const customers = await stripe.customers.search({
      query: `metadata['userId']:'${userId}'`,
    })

    if (!customers.data.length) {
      return false
    }

    const subscriptions = await stripe.subscriptions.list({
      customer: customers.data[0].id,
      status: 'all',
    })

    return subscriptions.data.some(subscription => 
      !subscription.cancel_at_period_end && 
      ['active', 'trialing'].includes(subscription.status)
    )
  } catch (error) {
    console.error('Error checking subscription:', error)
    return false
  }
}

export async function createCustomerPortalSession(userId: string) {
  try {
    if (!process.env.NEXT_PUBLIC_APP_URL) {
      throw new Error('Missing NEXT_PUBLIC_APP_URL environment variable')
    }

    // Find customer by userId
    const customers = await stripe.customers.search({
      query: `metadata['userId']:'${userId}'`,
    })

    if (!customers.data.length) {
      throw new Error('No customer found')
    }

    // Create Stripe portal session
    const session = await stripe.billingPortal.sessions.create({
      customer: customers.data[0].id,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`,
      locale: 'de',
    })

    if (!session.url) {
      throw new Error('Failed to create portal session')
    }

    return { url: session.url }
  } catch (error) {
    console.error('Error creating portal session:', error)
    throw error
  }
}

export async function createCheckoutSession(userId: string, userEmail: string) {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL

    if (!baseUrl) {
      throw new Error('Missing NEXT_PUBLIC_APP_URL environment variable')
    }

    // Create or get customer
    let customer: Stripe.Customer
    
    const existingCustomers = await stripe.customers.search({
      query: `metadata['userId']:'${userId}'`,
    })

    if (existingCustomers.data.length > 0) {
      customer = existingCustomers.data[0]
    } else {
      customer = await stripe.customers.create({
        email: userEmail,
        metadata: {
          userId: userId,
        },
      })
    }

    // Calculate March 1st, 2025 timestamp
    const startDate = new Date('2025-03-01T00:00:00Z')
    const startTimestamp = Math.floor(startDate.getTime() / 1000)

    // Create a checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customer.id,
      payment_method_types: ['card', 'sepa_debit'],
      mode: 'subscription',
      allow_promotion_codes: true,
      billing_address_collection: 'required',
      customer_update: {
        address: 'auto',
        name: 'auto',
      },
      locale:'de',
      line_items: [
        {
          price: process.env.STRIPE_PRICE_ID,
          quantity: 1,
        },
      ],
      subscription_data: {
        trial_end: startTimestamp,
        metadata: {
          userId: userId,
          scheduled_start: startDate.toISOString(),
        },
      },
      success_url: `${baseUrl}/dashboard?success=true`,
      cancel_url: `${baseUrl}/dashboard?canceled=true`,
      metadata: {
        userId: userId,
      },
    })

    return { url: session.url }
  } catch (error) {
    console.error('Error in createCheckoutSession:', error)
    throw error
  }
}

export async function getSubscriptionDetails(userId: string) {
  try {
    const customers = await stripe.customers.search({
      query: `metadata['userId']:'${userId}'`,
    })

    if (!customers.data.length) {
      return null
    }

    const subscriptions = await stripe.subscriptions.list({
      customer: customers.data[0].id,
      limit: 1,
      expand: ['data.latest_invoice'],
      status: 'all', // This will include canceled subscriptions
    })

    if (!subscriptions.data.length) {
      return null
    }

    const subscription = subscriptions.data[0]
    const startDate = new Date('2025-03-01T00:00:00Z')

    return {
      status: subscription.status,
      startDate: startDate.toISOString(),
      isPending: subscription.status === 'incomplete',
      isCanceled: subscription.cancel_at_period_end || subscription.status === 'canceled',
      cancelAt: subscription.cancel_at ? new Date(subscription.cancel_at * 1000).toISOString() : null,
      currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
    }
  } catch (error) {
    console.error('Error getting subscription details:', error)
    return null
  }
}
