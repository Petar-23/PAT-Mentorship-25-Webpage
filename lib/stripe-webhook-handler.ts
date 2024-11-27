import type Stripe from 'stripe'
import { ensureCustomerTaxInfo } from './updateCustomers'

interface StripeError extends Error {
  type: string;
  code?: string;
  param?: string;
}

export async function handleStripeEvent(event: Stripe.Event) {
  console.log('Received Stripe event:', event.type)
  try {
    switch (event.type) {
      case 'customer.created': {
        const customer = event.data.object as Stripe.Customer
        await ensureCustomerTaxInfo(customer.id)
        break
      }

      case 'customer.subscription.created': {
        const subscription = event.data.object as Stripe.Subscription
        if (subscription.customer) {
          const customerId = typeof subscription.customer === 'string' 
            ? subscription.customer 
            : subscription.customer.id
          await ensureCustomerTaxInfo(customerId)
        }
        break
      }

      case 'invoice.created':
      case 'invoice.finalized':
        console.log(`Invoice event ${event.type} received - tax info should be included automatically`)
        break

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }
  } catch (error) {
    if (error instanceof Error) {
      const stripeError = error as StripeError
      console.error('Error handling Stripe event:', {
        message: stripeError.message,
        type: stripeError.type,
        code: stripeError.code
      })
    }
    throw error
  }
}

export const runtime = 'edge'
export const dynamic = 'force-dynamic'