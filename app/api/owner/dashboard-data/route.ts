// src/app/api/owner/dashboard-data/route.ts
import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import type Stripe from 'stripe'

// Define interfaces for type safety
interface CustomerData {
  id: string;
  email: string | null;
  name: string | null;
  createdAt: string;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  totalSpend: number;
  paymentCount: number;
  currency: string;
}

// Optimize the route by reducing API calls
export async function GET() {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Step 1: Fetch all customers with expanded subscription data - single API call
    // Increased limit to avoid pagination issues
    const customers = await stripe.customers.list({
      limit: 100,
      expand: ['data.subscriptions', 'data.subscriptions.data.default_payment_method']
    })

    // Step 2: Fetch all charges in one go instead of per customer
    const charges = await stripe.charges.list({
      limit: 100
    })
    
    // Additional logging for debugging
    console.log(`Found ${customers.data.length} customers and ${charges.data.length} charges`)

    // Step 3: Create a map of customer IDs to their charges for quick lookup
    const customerCharges = new Map<string, Stripe.Charge[]>()
    charges.data.forEach(charge => {
      if (charge.customer) {
        const customerId = typeof charge.customer === 'string' ? charge.customer : charge.customer.id
        if (!customerCharges.has(customerId)) {
          customerCharges.set(customerId, [])
        }
        customerCharges.get(customerId)?.push(charge)
      }
    })

    // Step 4: Process customers without additional API calls per customer
    const enhancedCustomers: CustomerData[] = customers.data.map(customer => {
      const subscriptions = customer.subscriptions?.data || []
      const hasActiveSubscription = subscriptions.some(sub => 
        ['active', 'trialing'].includes(sub.status) && !sub.cancel_at_period_end
      )

      // Calculate payment status
      let paymentStatus = "No Status"
      if (hasActiveSubscription) {
        if (customer.balance > 0) {
          paymentStatus = "Active with Balance"
        } else if (subscriptions.some(sub => sub.status === 'trialing')) {
          paymentStatus = "Trialing"
        } else {
          paymentStatus = "Active and Paid"
        }
      } else if (subscriptions.length > 0) {
        paymentStatus = "Inactive"
      }

      // Determine payment method based on subscription data with more robust handling
      let paymentMethod = "Not Available"
      try {
        // Log subscription data for debugging
        console.log(`Processing payment method for customer ${customer.id}`)
        
        if (subscriptions.length > 0) {
          const subscription = subscriptions[0]
          console.log(`Customer ${customer.id} has subscription: ${subscription.id}`)
          
          // Check if default_payment_method exists and extract its details
          if (subscription.default_payment_method) {
            console.log(`Found payment method for sub ${subscription.id}: ${
              typeof subscription.default_payment_method === 'string' 
              ? subscription.default_payment_method 
              : 'object'
            }`)
            
            const pm = subscription.default_payment_method
            
            if (typeof pm === 'string') {
              // It's just a string ID, try a fallback approach
              paymentMethod = 'Card (Details Not Expanded)'
            } else if (pm && pm.type) {
              // Properly expanded payment method object
              if (pm.type === 'card' && pm.card) {
                paymentMethod = `Credit Card (${pm.card.brand || 'Unknown Brand'})`
              } else if (pm.type === 'sepa_debit') {
                paymentMethod = 'Bank Transfer (SEPA)'
              } else {
                paymentMethod = pm.type
              }
            }
          } else {
            // Log that no payment method was found
            console.log(`No default_payment_method found for subscription ${subscription.id}`)
            
            // Check if there's a payment method in the customer object directly
            if (customer.invoice_settings?.default_payment_method) {
              paymentMethod = 'Customer Default Method'
            } else if (hasActiveSubscription) {
              paymentMethod = 'Pending Payment Method'
            }
          }
        } else if (hasActiveSubscription) {
          paymentMethod = 'Pending Payment Method'
        }
      } catch (e) {
        console.error(`Error extracting payment method for customer ${customer.id}:`, e)
        paymentMethod = 'Error Extracting Method'
      }

      // Calculate total spent by this customer using the pre-fetched charges
      const customerChargesList = customerCharges.get(customer.id) || []
      const successfulCharges = customerChargesList.filter(charge => charge.status === 'succeeded')
      const totalSpent = successfulCharges.reduce((sum, charge) => sum + charge.amount, 0) / 100

      return {
        id: customer.id,
        email: customer.email,
        name: customer.name || null,
        createdAt: new Date(customer.created * 1000).toISOString(),
        status: hasActiveSubscription ? 'active' : 'inactive',
        paymentStatus,
        paymentMethod,
        totalSpend: totalSpent,
        paymentCount: successfulCharges.length,
        currency: customer.currency || 'eur'
      }
    })

    // Calculate aggregated statistics
    const programStartDate = new Date('2025-03-01')
    const totalCustomers = enhancedCustomers.length
    const activeCustomers = enhancedCustomers.filter(c => c.status === 'active').length
    const paidCustomers = enhancedCustomers.filter(c => c.totalSpend > 0).length
    
    // Log the payment methods we found for debugging
    console.log('Payment methods distribution:')
    const methodCounts: Record<string, number> = {}
    enhancedCustomers.forEach(c => {
      if (!methodCounts[c.paymentMethod]) methodCounts[c.paymentMethod] = 0
      methodCounts[c.paymentMethod]++
    })
    console.log(methodCounts)
    
    // Filter revenues starting from March 2025
    const relevantCustomers = enhancedCustomers.filter(customer => {
      const createdDate = new Date(customer.createdAt)
      return createdDate >= programStartDate
    })
    
    const totalRevenue = relevantCustomers.reduce((sum, c) => sum + c.totalSpend, 0)

    // Categorize by payment method
    const paymentMethodGroups: Record<string, { count: number; revenue: number }> = {}
    enhancedCustomers.forEach(customer => {
      const method = customer.paymentMethod
      if (!paymentMethodGroups[method]) {
        paymentMethodGroups[method] = {
          count: 0,
          revenue: 0
        }
      }
      paymentMethodGroups[method].count++
      paymentMethodGroups[method].revenue += customer.totalSpend
    })

    const paymentMethodData = Object.keys(paymentMethodGroups).map(method => ({
      name: method,
      value: paymentMethodGroups[method].count,
      revenue: paymentMethodGroups[method].revenue
    }))

    // Create month-by-month data starting from March 2025
    const monthlyData = generateMonthlyData(enhancedCustomers, programStartDate)

    // Create a response with proper cache control headers
    const response = NextResponse.json({
      customers: enhancedCustomers,
      stats: {
        totalCustomers,
        activeCustomers,
        paidCustomers,
        totalRevenue
      },
      paymentMethodData,
      monthlyData
    })

    // Set cache control headers directly on the response
    response.headers.set('Cache-Control', 'no-store, max-age=0')
    
    return response
  } catch (error) {
    console.error('Error in dashboard-data route:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    )
  }
}

function generateMonthlyData(customers: CustomerData[], startDate: Date) {
  const now = new Date()
  const months = []
  
  // Create an array of months from program start to now
  let currentMonth = new Date(startDate)
  while (currentMonth <= now) {
    months.push({
      year: currentMonth.getFullYear(),
      month: currentMonth.getMonth() + 1,
      label: `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}`
    })
    
    // Move to next month
    currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1)
  }
  
  // Process customer data by month
  return months.map(monthData => {
    const monthStart = new Date(monthData.year, monthData.month - 1, 1)
    const monthEnd = new Date(monthData.year, monthData.month, 0)
    
    const newCustomers = customers.filter(customer => {
      const createdDate = new Date(customer.createdAt)
      return createdDate >= monthStart && createdDate <= monthEnd
    })
    
    const monthRevenue = customers
      .filter(customer => {
        const createdDate = new Date(customer.createdAt)
        return createdDate <= monthEnd && customer.totalSpend > 0
      })
      .reduce((sum, customer) => sum + customer.totalSpend, 0)
    
    return {
      month: monthData.label,
      newCustomers: newCustomers.length,
      revenue: monthRevenue
    }
  })
}

// Use serverless runtime instead of edge for longer timeout
export const runtime = 'nodejs' // or remove for default serverless
export const dynamic = 'force-dynamic'