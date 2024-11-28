// src/lib/stripe-webhook-handler.ts

import type Stripe from 'stripe'
import { ensureCustomerTaxInfo } from './updateCustomers'

// Define type for Stripe error handling
interface StripeError extends Error {
  type: string;
  code?: string;
  param?: string;
}

/**
 * Main webhook handler that processes various Stripe events.
 * This function ensures proper tax information is set up for customers
 * and verifies invoice configuration for German legal requirements.
 */
export async function handleStripeEvent(event: Stripe.Event) {
  console.log('Received Stripe event:', event.type)
  try {
    switch (event.type) {
      case 'customer.created': {
        // When a new customer is created, immediately set up their tax information
        // This ensures all future invoices will include proper German legal requirements
        const customer = event.data.object as Stripe.Customer
        console.log(`New customer created: ${customer.id}`)
        
        await ensureCustomerTaxInfo(customer.id)
        break
      }

      case 'customer.subscription.created': {
        // Double-check tax information when a subscription is created
        // This serves as a safety net in case the customer.created handler failed
        const subscription = event.data.object as Stripe.Subscription
        if (subscription.customer) {
          const customerId = typeof subscription.customer === 'string' 
            ? subscription.customer 
            : subscription.customer.id
          
          console.log(`New subscription created for customer: ${customerId}`)
          await ensureCustomerTaxInfo(customerId)
        }
        break
      }

      case 'invoice.created': {
        // Log invoice creation - no action needed as tax info is set at customer level
        const invoice = event.data.object as Stripe.Invoice
        console.log(`New invoice created ${invoice.id} - tax info should be included automatically`)
        
        // Optional: Add verification here if you want to double-check
        if (!invoice.footer?.includes('Steueridentifizierungsnummer')) {
          console.warn(`Warning: Invoice ${invoice.id} may be missing tax information`)
        }
        break
      }

      case 'invoice.finalized': {
        // Monitor finalized invoices to ensure they have proper tax information
        const invoice = event.data.object as Stripe.Invoice
        console.log(`Invoice finalized ${invoice.id}`)
        
        // Optional: Add monitoring for tax information presence
        if (!invoice.footer?.includes('Steueridentifizierungsnummer')) {
          console.warn(`Warning: Finalized invoice ${invoice.id} may be missing tax information`)
          
          // If the invoice belongs to a customer, try to update their settings for future invoices
          if (invoice.customer) {
            const customerId = typeof invoice.customer === 'string'
              ? invoice.customer
              : invoice.customer.id
            
            console.log(`Attempting to update tax info for customer ${customerId}`)
            await ensureCustomerTaxInfo(customerId)
          }
        }
        break
      }

      case 'checkout.session.completed': {
        // Log checkout completion - customer creation and subscription creation
        // events will handle the tax information setup
        console.log('Checkout completed, customer and subscription events will follow')
        break
      }

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

// These exports are needed for the Edge runtime in Next.js
export const runtime = 'edge'
export const dynamic = 'force-dynamic'