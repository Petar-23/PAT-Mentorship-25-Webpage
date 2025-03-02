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
  status: string; // 'active', 'cancelled', 'interested'
  paymentStatus: string;
  paymentMethod: string;
  totalSpend: number;
  pendingAmounts: number;
  paymentCount: number;
  currency: string;
  subscriptionStartDate: string | null;
  subscriptionEndDate: string | null;
}

// Optimize the route by reducing API calls
export async function GET() {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Important date constants
    const PROGRAM_START_DATE = new Date('2025-03-01')
    const TODAY = new Date()

    // Step 1: Fetch all customers with expanded subscription data and payment methods
    const customers = await stripe.customers.list({
      limit: 100,
      expand: [
        'data.subscriptions',
        'data.subscriptions.data.default_payment_method',
        'data.invoice_settings.default_payment_method'
      ]
    })

    // Step 2: Fetch invoices to track SEPA payments status
    const invoices = await stripe.invoices.list({
      limit: 100,
      status: 'open',
      expand: ['data.customer', 'data.payment_intent']
    })
    
    // Create a map of customer IDs to their open invoices for quick lookup
    const pendingInvoicesByCustomer = new Map<string, Stripe.Invoice[]>()
    invoices.data.forEach(invoice => {
      if (invoice.customer) {
        const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer.id
        if (!pendingInvoicesByCustomer.has(customerId)) {
          pendingInvoicesByCustomer.set(customerId, [])
        }
        pendingInvoicesByCustomer.get(customerId)?.push(invoice)
      }
    })

    // Step 3: Fetch all charges for revenue tracking
    const charges = await stripe.charges.list({
      limit: 100,
      created: {
        // Only include charges since March 2025 (program start)
        gte: Math.floor(PROGRAM_START_DATE.getTime() / 1000)
      }
    })
    
    // Create a map of customer IDs to their charges
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

    // Step 4: Process customers with proper classification
    const enhancedCustomers: CustomerData[] = customers.data.map(customer => {
      const subscriptions = customer.subscriptions?.data || []
      
      // Determine status (active, cancelled, interested)
      let status = 'interested' // Default status for customers who never completed checkout
      let subscriptionStartDate: string | null = null
      let subscriptionEndDate: string | null = null
      
      // Check if this customer has ever had a subscription
      if (subscriptions.length > 0) {
        const latestSubscription = subscriptions[0]
        
        // Get subscription dates
        subscriptionStartDate = latestSubscription.start_date 
          ? new Date(latestSubscription.start_date * 1000).toISOString() 
          : null
          
        // If a subscription was cancelled, store the end date
        if (latestSubscription.canceled_at) {
          subscriptionEndDate = new Date(latestSubscription.canceled_at * 1000).toISOString()
        } else if (latestSubscription.cancel_at) {
          subscriptionEndDate = new Date(latestSubscription.cancel_at * 1000).toISOString()
        } else if (latestSubscription.ended_at) {
          subscriptionEndDate = new Date(latestSubscription.ended_at * 1000).toISOString()
        }
        
        // Determine status based on subscription state
        if (['active', 'trialing'].includes(latestSubscription.status) && !latestSubscription.cancel_at_period_end) {
          status = 'active'
        } else if (latestSubscription.status === 'canceled' || 
                  latestSubscription.cancel_at_period_end ||
                  latestSubscription.canceled_at) {
          status = 'cancelled'
        }
      }
      
      // Determine payment status more accurately
      let paymentStatus = "No Payments"
      let pendingAmounts = 0
      
      // Check for pending SEPA payments
      const pendingInvoices = pendingInvoicesByCustomer.get(customer.id) || []
      if (pendingInvoices.length > 0) {
        pendingAmounts = pendingInvoices.reduce((sum, invoice) => sum + (invoice.amount_due || 0), 0) / 100
        paymentStatus = `Pending Payment (${pendingInvoices.length})`
      } else if (status === 'active') {
        paymentStatus = "Active and Paid"
      } else if (status === 'cancelled') {
        paymentStatus = "Cancelled"
      }
      
      if (customer.balance > 0) {
        const balanceInEuro = customer.balance / 100
        paymentStatus = `${paymentStatus} (Balance Due: €${balanceInEuro})`
        pendingAmounts += balanceInEuro
      }

      // Determine payment method with better error handling
      let paymentMethod = "Not Available"
      try {
        // Check subscription payment method first
        if (subscriptions.length > 0 && subscriptions[0].default_payment_method) {
          const pm = subscriptions[0].default_payment_method
          if (typeof pm !== 'string' && pm.type === 'card' && pm.card) {
            paymentMethod = `Card (${pm.card.brand})`
          } else if (typeof pm !== 'string' && pm.type === 'sepa_debit') {
            paymentMethod = 'SEPA Direct Debit'
          } else if (typeof pm !== 'string') {
            paymentMethod = pm.type
          }
        } 
        // Fallback to customer default payment method if subscription method not available
        else if (customer.invoice_settings?.default_payment_method) {
          const pm = customer.invoice_settings.default_payment_method
          if (typeof pm !== 'string' && pm.type === 'card' && pm.card) {
            paymentMethod = `Card (${pm.card.brand})`
          } else if (typeof pm !== 'string' && pm.type === 'sepa_debit') {
            paymentMethod = 'SEPA Direct Debit'
          } else if (typeof pm !== 'string') {
            paymentMethod = pm.type
          }
        } else if (status === 'active') {
          paymentMethod = 'Pending Payment Method'
        }
      } catch (error) {
        console.error(`Error determining payment method for customer ${customer.id}:`, error)
      }

      // Calculate actual received money (exclude pending SEPA payments)
      const customerChargesList = customerCharges.get(customer.id) || []
      const successfulCharges = customerChargesList.filter(
        charge => charge.status === 'succeeded' && 
        // Only include charges after program start
        charge.created >= Math.floor(PROGRAM_START_DATE.getTime() / 1000)
      )
      
      const totalSpent = successfulCharges.reduce((sum, charge) => sum + charge.amount, 0) / 100

      return {
        id: customer.id,
        email: customer.email,
        name: customer.name || null,
        createdAt: new Date(customer.created * 1000).toISOString(),
        status,
        paymentStatus,
        paymentMethod,
        totalSpend: totalSpent,
        pendingAmounts,
        paymentCount: successfulCharges.length,
        currency: customer.currency || 'eur',
        subscriptionStartDate,
        subscriptionEndDate
      }
    })

    // Calculate statistics
    const activeCustomers = enhancedCustomers.filter(c => c.status === 'active').length
    const cancelledCustomers = enhancedCustomers.filter(c => c.status === 'cancelled').length
    const interestedCustomers = enhancedCustomers.filter(c => c.status === 'interested').length
    
    // Only count real revenue (not pending payments)
    const confirmedRevenue = enhancedCustomers.reduce((sum, c) => sum + c.totalSpend, 0)
    
    // Track pending revenue separately
    const pendingRevenue = enhancedCustomers.reduce((sum, c) => sum + c.pendingAmounts, 0)
    
    // Customers with pending SEPA payments
    const pendingPaymentsCount = enhancedCustomers.filter(c => c.pendingAmounts > 0).length

    // Create customer groups for the dashboard
    const activeCustomersList = enhancedCustomers.filter(c => c.status === 'active')
    const cancelledCustomersList = enhancedCustomers.filter(c => {
      // Only include cancellations after program start
      if (c.status !== 'cancelled') return false
      if (!c.subscriptionEndDate) return false
      
      const cancelDate = new Date(c.subscriptionEndDate)
      return cancelDate >= PROGRAM_START_DATE
    })
    const interestedCustomersList = enhancedCustomers.filter(c => c.status === 'interested')

    // Categorize by payment method
    const paymentMethodGroups: Record<string, { count: number; revenue: number; pendingRevenue: number }> = {}
    enhancedCustomers.forEach(customer => {
      // Skip interested customers (they don't have payment methods yet)
      if (customer.status === 'interested') return
      
      const method = customer.paymentMethod
      if (!paymentMethodGroups[method]) {
        paymentMethodGroups[method] = {
          count: 0,
          revenue: 0,
          pendingRevenue: 0
        }
      }
      paymentMethodGroups[method].count++
      paymentMethodGroups[method].revenue += customer.totalSpend
      paymentMethodGroups[method].pendingRevenue += customer.pendingAmounts
    })

    const paymentMethodData = Object.keys(paymentMethodGroups).map(method => ({
      name: method,
      value: paymentMethodGroups[method].count,
      revenue: paymentMethodGroups[method].revenue,
      pendingRevenue: paymentMethodGroups[method].pendingRevenue
    }))

    // Create month-by-month data starting from March 2025
    const monthlyData = generateMonthlyData(enhancedCustomers, PROGRAM_START_DATE, TODAY)

    // Create a response with the processed data
    const response = NextResponse.json({
      customers: enhancedCustomers,
      customerGroups: {
        active: activeCustomersList,
        cancelled: cancelledCustomersList,
        interested: interestedCustomersList
      },
      stats: {
        totalCustomers: enhancedCustomers.length,
        activeCustomers,
        cancelledCustomers,
        interestedCustomers,
        confirmedRevenue,
        pendingRevenue,
        totalRevenue: confirmedRevenue + pendingRevenue,
        pendingPaymentsCount
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

function generateMonthlyData(customers: CustomerData[], startDate: Date, endDate: Date) {
  const months = []
  
  // Create an array of months from program start until now
  let currentMonth = new Date(startDate.getFullYear(), startDate.getMonth(), 1)
  const lastMonth = new Date(endDate.getFullYear(), endDate.getMonth(), 1)
  
  while (currentMonth <= lastMonth) {
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
    
    // Count new customers this month (based on subscription start, not account creation)
    const newCustomers = customers.filter(customer => {
      if (!customer.subscriptionStartDate) return false
      const startDate = new Date(customer.subscriptionStartDate)
      return startDate >= monthStart && startDate <= monthEnd
    })
    
    // Calculate confirmed revenue this month
    const confirmedRevenue = customers
      .filter(customer => {
        if (!customer.subscriptionStartDate) return false
        const startDate = new Date(customer.subscriptionStartDate)
        return startDate <= monthEnd && customer.totalSpend > 0
      })
      .reduce((sum, customer) => sum + customer.totalSpend, 0)
    
    // Calculate pending revenue this month
    const pendingRevenue = customers
      .filter(customer => {
        if (!customer.subscriptionStartDate) return false
        const startDate = new Date(customer.subscriptionStartDate)
        return startDate <= monthEnd && customer.pendingAmounts > 0
      })
      .reduce((sum, customer) => sum + customer.pendingAmounts, 0)
    
    return {
      month: monthData.label,
      newCustomers: newCustomers.length,
      confirmedRevenue,
      pendingRevenue,
      totalRevenue: confirmedRevenue + pendingRevenue,
      // Add a running total calculation as well
      totalCustomersToDate: customers.filter(c => {
        if (!c.subscriptionStartDate) return false
        return new Date(c.subscriptionStartDate) <= monthEnd
      }).length
    }
  })
}

// Use serverless runtime instead of edge for longer timeout
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'