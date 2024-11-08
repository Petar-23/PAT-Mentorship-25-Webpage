// src/app/api/customer-count/route.ts
import { stripe } from '@/lib/stripe'
import { NextResponse } from 'next/server'

// Cache the response for 5 minutes
export const revalidate = 300

export async function GET() {
  try {
    // Get customers that are on the waitlist
    const customerList = await stripe.customers.list({
      limit: 100, // Adjust based on your needs
      expand: ['data.subscriptions'],
    });

    // Get the actual count from the data array length
    const totalCount = customerList.data.length;

    // Optional: You could add more specific counting logic
    // For example, counting only customers with specific metadata
    /*
    const waitlistCount = customerList.data.filter(customer => 
      customer.metadata?.waitlistStatus === 'active'
    ).length;
    */

    return NextResponse.json({ 
      count: totalCount,
      lastUpdated: new Date().toISOString()
    })
  } catch (error) {
    console.error('Error fetching customer count:', error)
    return NextResponse.json(
      { error: 'Failed to fetch customer count' }, 
      { status: 500 }
    )
  }
}