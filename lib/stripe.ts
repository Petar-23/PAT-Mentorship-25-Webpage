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

    // Define program start date
    const programStartDate = new Date('2025-03-01T23:59:00Z');
    
    // Create a checkout session WITHOUT trial for now
    // This bypasses the trial_end validation entirely
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
      locale: 'de',
      line_items: [
        {
          price: process.env.STRIPE_PRICE_ID,
          quantity: 1,
        },
      ],
      subscription_data: {
        // No trial_end parameter - subscription will start immediately
        metadata: {
          userId: userId,
          scheduledStart: programStartDate.toISOString(),
          signupType: "pre_launch"
        }
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

export async function getSubscriptionDetails(
  userId: string, 
  options = { 
    retryCount: 3,
    checkForRecentCheckout: false 
  }
) {
  // We use the retryCount from options, defaulting to 3 if not specified
  const maxRetries = options.retryCount

  for (let i = 0; i < maxRetries; i++) {
    try {
      const customers = await stripe.customers.search({
        query: `metadata['userId']:'${userId}'`,
      })

      // Log the attempt and result for debugging
      console.log(`Attempt ${i + 1}: Found ${customers.data.length} customers for userId ${userId}`)

      if (!customers.data.length) {
        // If we're checking for recent checkout or it's not the last attempt, wait and retry
        if (options.checkForRecentCheckout || i < maxRetries - 1) {
          console.log(`No customer found, waiting before retry ${i + 1}/${maxRetries}`)
          await new Promise(resolve => setTimeout(resolve, 2000))
          continue
        }
        return null
      }

      const subscriptions = await stripe.subscriptions.list({
        customer: customers.data[0].id,
        limit: 1,
        expand: ['data.latest_invoice'],
        status: 'all',
      })

      console.log(`Found ${subscriptions.data.length} subscriptions for customer ${customers.data[0].id}`)

      // Similar logic for subscriptions - retry if needed
      if (!subscriptions.data.length) {
        if (options.checkForRecentCheckout || i < maxRetries - 1) {
          console.log(`No subscription found, waiting before retry ${i + 1}/${maxRetries}`)
          await new Promise(resolve => setTimeout(resolve, 2000))
          continue
        }
        return null
      }

      const subscription = subscriptions.data[0]
      const startDate = new Date('2025-03-01T00:00:00Z')

      // Log successful retrieval
      console.log(`Successfully retrieved subscription with status: ${subscription.status}`)

      return {
        status: subscription.status,
        startDate: startDate.toISOString(),
        isPending: subscription.status === 'incomplete',
        isCanceled: subscription.cancel_at_period_end || subscription.status === 'canceled',
        cancelAt: subscription.cancel_at ? new Date(subscription.cancel_at * 1000).toISOString() : null,
        currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
      }

    } catch (error) {
      // Maintain your detailed error logging
      console.error(`Attempt ${i + 1} failed:`, error)
      
      // On the last attempt, throw the error
      if (i === maxRetries - 1) {
        console.error('All retry attempts failed. Final error:', error)
        throw error
      }

      // Otherwise, wait and try again
      console.log(`Waiting before retry attempt ${i + 2}/${maxRetries}`)
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
  }

  // If we've exhausted all retries without success or error
  console.log('All attempts completed without finding subscription data')
  return null
}
