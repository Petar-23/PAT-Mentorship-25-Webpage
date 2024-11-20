// src/app/api/admin/customers/route.ts
import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'

export async function GET() {
  try {
    const { userId } = await auth()

    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    // Get all customers from Stripe
    const customers = await stripe.customers.list({
      limit: 100,
      //expand: ['data.metadata']
    })

    // Format customer data
    const formattedCustomers = customers.data.map(customer => ({
      email: customer.email,
      createdAt: new Date(customer.created * 1000).toISOString(),
      metadata: customer.metadata
    }))
    console.log(formattedCustomers)

    return NextResponse.json({ customers: formattedCustomers })
  } catch (error) {
    console.error('Error fetching customers:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}