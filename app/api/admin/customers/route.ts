// src/app/api/admin/customers/route.ts
import { auth, clerkClient } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import type Stripe from 'stripe'

interface FormattedCustomer {
  email: string | null;
  createdAt: string;
  status: string;
  displayStatus: string; // Added for display purposes
  subscriptionEnd?: string | null;
  metadata?: {
    firstName?: string;
    lastName?: string;
  };
}

function getCustomerStatus(customer: Stripe.Customer): { 
  status: string;
  displayStatus: string;
  subscriptionEnd: string | null; 
} {
  const subscriptions = customer.subscriptions as Stripe.ApiList<Stripe.Subscription> | undefined
  
  if (!subscriptions?.data?.length) {
    return { 
      status: 'custom',
      displayStatus: 'Interested',
      subscriptionEnd: null 
    }
  }

  const subscription = subscriptions.data[0]
  
  if (subscription.cancel_at_period_end) {
    return { 
      status: 'canceling',
      displayStatus: 'Canceling',
      subscriptionEnd: new Date(subscription.current_period_end * 1000).toISOString()
    }
  }

  if (subscription.canceled_at) {
    return { 
      status: 'canceled',
      displayStatus: 'Canceled',
      subscriptionEnd: new Date(subscription.canceled_at * 1000).toISOString()
    }
  }

  if (subscription.status === 'trialing') {
    return { 
      status: 'trialing',
      displayStatus: 'Waitlist',
      subscriptionEnd: new Date(subscription.trial_end! * 1000).toISOString()
    }
  }

  return { 
    status: subscription.status,
    displayStatus: subscription.status.charAt(0).toUpperCase() + subscription.status.slice(1),
    subscriptionEnd: null
  }
}

export async function GET() {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const client = await clerkClient()
    const memberships = await client.users.getOrganizationMembershipList({
      userId,
      limit: 100,
    })
    const isAdmin = memberships.data.some((m) => m.role === 'org:admin')

    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const customers = await stripe.customers.list({
      limit: 100,
      expand: ['data.subscriptions']
    })

    const formattedCustomers = customers.data.map((customer): FormattedCustomer => {
      const { status, displayStatus, subscriptionEnd } = getCustomerStatus(customer)
      return {
        email: customer.email,
        createdAt: new Date(customer.created * 1000).toISOString(),
        status,
        displayStatus,
        subscriptionEnd,
        metadata: customer.metadata as { firstName?: string; lastName?: string }
      }
    })

    // Group customers by status
    const waitlistCustomers = formattedCustomers.filter(c => c.status === 'trialing')
    const cancelingCustomers = formattedCustomers.filter(c => c.status === 'canceling')
    const interestedCustomers = formattedCustomers.filter(c => c.status === 'custom')

    const priceId = process.env.STRIPE_PRICE_ID!
    const price = await stripe.prices.retrieve(priceId)

    return NextResponse.json({ 
      waitlistCustomers,
      cancelingCustomers,
      interestedCustomers,
      monthlyPrice: price.unit_amount ? price.unit_amount / 100 : 0,
      waitlistCount: waitlistCustomers.length,
      totalCustomers: customers.data.length
    })
  } catch (error) {
    console.error('Error in admin/customers route:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    )
  }
}