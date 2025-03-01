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

export async function GET() {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch all customers with expanded payment info
    const customers = await stripe.customers.list({
      limit: 100,
      expand: ['data.subscriptions']
    })

    // Process customers to get payment methods
    const enhancedCustomers: CustomerData[] = []
    
    for (const customer of customers.data) {
      // Fetch payment methods for this customer
      let paymentMethods: Stripe.ApiList<Stripe.PaymentMethod> | { data: [] } = { data: [] }
      try {
        paymentMethods = await stripe.paymentMethods.list({
          customer: customer.id,
          type: 'card'
        })
      } catch (error) {
        console.error(`Error fetching payment methods for ${customer.id}:`, error)
      }

      // Try to get SEPA payment methods if available
      let sepaPaymentMethods: Stripe.ApiList<Stripe.PaymentMethod> | { data: [] } = { data: [] }
      try {
        sepaPaymentMethods = await stripe.paymentMethods.list({
          customer: customer.id,
          type: 'sepa_debit'
        })
      } catch (error) {
        // SEPA might not be enabled, just continue
        console.error(error)
      }

      // Combine all payment methods
      const allPaymentMethods = [
        ...paymentMethods.data,
        ...sepaPaymentMethods.data
      ]

      const subscriptions = customer.subscriptions?.data || []
      const hasActiveSubscription = subscriptions.some(sub => 
        ['active', 'trialing'].includes(sub.status) && !sub.cancel_at_period_end
      )

      // Calculate payment status and method
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

      // Determine payment method
      let paymentMethod = "Not Available"
      if (allPaymentMethods.length > 0) {
        const defaultMethod = allPaymentMethods[0]
        if (defaultMethod.type === 'card' && defaultMethod.card) {
          paymentMethod = `Credit Card (${defaultMethod.card.brand})`
        } else if (defaultMethod.type === 'sepa_debit') {
          paymentMethod = 'Bank Transfer (SEPA)'
        } else {
          paymentMethod = defaultMethod.type
        }
      } else if (hasActiveSubscription) {
        // If active but no payment method found, likely SEPA awaiting confirmation
        paymentMethod = 'Bank Transfer (SEPA) Pending'
      }

      // Calculate total spent by this customer
      const totalSpent = await calculateCustomerSpend(customer.id)

      enhancedCustomers.push({
        id: customer.id,
        email: customer.email,
        name: customer.name || null, // Ensure name is string | null, not undefined
        createdAt: new Date(customer.created * 1000).toISOString(),
        status: hasActiveSubscription ? 'active' : 'inactive',
        paymentStatus,
        paymentMethod,
        totalSpend: totalSpent,
        paymentCount: totalSpent > 0 ? 1 : 0,
        currency: customer.currency || 'eur'
      })
    }

    // Calculate aggregated statistics
    const programStartDate = new Date('2025-03-01')
    const totalCustomers = enhancedCustomers.length
    const activeCustomers = enhancedCustomers.filter(c => c.status === 'active').length
    const paidCustomers = enhancedCustomers.filter(c => c.totalSpend > 0).length
    
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

    return NextResponse.json({
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
  } catch (error) {
    console.error('Error in dashboard-data route:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    )
  }
}

async function calculateCustomerSpend(customerId: string): Promise<number> {
  try {
    // Get charges for this customer
    const charges = await stripe.charges.list({
      customer: customerId,
      limit: 100
    })
    
    // Sum up successful charges
    return charges.data
      .filter(charge => charge.status === 'succeeded')
      .reduce((sum, charge) => sum + charge.amount, 0) / 100
  } catch (error) {
    console.error(`Error calculating spend for ${customerId}:`, error)
    return 0
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

export const dynamic = 'force-dynamic'