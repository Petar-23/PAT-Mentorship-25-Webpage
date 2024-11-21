'use client'

import { useUser } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useCallback } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Download, Users, BanknoteIcon, CalendarIcon, TrendingUpIcon } from 'lucide-react'
import { DashboardSkeleton } from '@/components/skeletons/admin-dashboard-skeleton'

interface Customer {
  email: string | null;
  createdAt: string;
  status: string;
  displayStatus: string;
  subscriptionEnd?: string | null;
  metadata?: {
    firstName?: string;
    lastName?: string;
  };
}

interface DashboardData {
  waitlistCustomers: Customer[];
  cancelingCustomers: Customer[];
  interestedCustomers: Customer[];
  monthlyPrice: number;
  waitlistCount: number;
  totalCustomers: number;
}

export default function AdminDashboard() {
  const { user, isSignedIn, isLoaded } = useUser()
  const router = useRouter()
  const [dashboardData, setDashboardData] = useState<DashboardData>({
    waitlistCustomers: [],
    cancelingCustomers: [],
    interestedCustomers: [],
    monthlyPrice: 0,
    waitlistCount: 0,
    totalCustomers: 0
  })
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const isAdmin = user?.organizationMemberships?.some(
    membership => membership.role === 'org:admin'
  )
  // Add the downloadCSV function
  const downloadCSV = () => {
    const headers = ['Email', 'Joined', 'Status', 'End Date'].join(',')
    const allCustomers = [
      ...dashboardData.waitlistCustomers,
      ...dashboardData.cancelingCustomers,
      ...dashboardData.interestedCustomers
    ]
    
    const csvContent = [
      headers,
      ...allCustomers.map(customer => [
        customer.email,
        new Date(customer.createdAt).toLocaleDateString(),
        customer.displayStatus,
        customer.subscriptionEnd ? new Date(customer.subscriptionEnd).toLocaleDateString() : ''
      ].join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.setAttribute('hidden', '')
    a.setAttribute('href', url)
    a.setAttribute('download', `customers-${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  const fetchCustomers = useCallback(async () => {
    try {
      setError(null)
      const response = await fetch('/api/admin/customers')
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const data = await response.json()
      setDashboardData(data)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An error occurred while fetching data'
      console.error('Error fetching customers:', errorMessage)
      setError(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.push('/')
      return
    }

    if (isLoaded && !isAdmin) {
      router.push('/dashboard')
      return
    }

    if (isAdmin) {
      fetchCustomers()
    }
  }, [isLoaded, isSignedIn, isAdmin, router, fetchCustomers])

  const calculateMRR = () => {
    return dashboardData.monthlyPrice * dashboardData.waitlistCount
  }

  const calculateARR = () => {
    return calculateMRR() * 12
  }

  const calculateYTDRevenue = () => {
    const now = new Date()
    const startDate = new Date(2025, 2, 1) // March 1st, 2025
    
    if (now < startDate) {
      return 0
    }

    const monthsActive = (
      (now.getFullYear() - startDate.getFullYear()) * 12 +
      (now.getMonth() - startDate.getMonth()) +
      (now.getDate() >= startDate.getDate() ? 1 : 0)
    )

    return dashboardData.monthlyPrice * dashboardData.waitlistCount * monthsActive
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Waitlist':
        return 'bg-green-100 text-green-800 border border-green-500'
      case 'Canceling':
        return 'bg-red-100 text-red-800 border border-red-500'
      case 'Interested':
        return 'bg-blue-100 text-blue-800 border-blue-500'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const CustomerList = ({ title, customers, emptyMessage }: { 
    title: string;
    customers: Customer[];
    emptyMessage: string;
  }) => (
    <div className="space-y-4">
      <h3 className="font-semibold text-lg">{title} ({customers.length})</h3>
      {customers.length === 0 ? (
        <p className="text-sm text-gray-500 italic">{emptyMessage}</p>
      ) : (
        <div className="grid gap-4">
          {customers.map((customer, index) => (
            <div key={index} className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
              <div>
                <p className="font-medium">{customer.email}</p>
                <div className="flex gap-2 items-center mt-1">
                  <p className="text-sm text-gray-500">
                    Joined {new Date(customer.createdAt).toLocaleDateString()}
                  </p>
                  <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(customer.displayStatus)}`}>
                    {customer.displayStatus}
                  </span>
                  {customer.subscriptionEnd && (
                    <span className="text-xs text-gray-500">
                      {customer.status === 'canceling' ? 'Ends' : 'Ended'} {new Date(customer.subscriptionEnd).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )

  if (!isLoaded || isLoading) {
    return <DashboardSkeleton />
  }

  if (!isAdmin) {
    return null
  }

  if (error) {
    return (
      <div className="container mx-auto py-10">
        <Card className="bg-red-50 border-red-200">
          <CardContent className="pt-6">
            <h3 className="text-lg font-semibold text-red-800 mb-2">Error Loading Dashboard</h3>
            <p className="text-red-600">{error}</p>
            <Button 
              onClick={() => fetchCustomers()}
              className="mt-4"
              variant="outline"
            >
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-10">
      <div className="grid gap-6">
        {/* Revenue Overview */}
        <div className="grid md:grid-cols-4 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Users className="h-5 w-5 text-blue-500" />
                Waitlist Members
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col">
                <p className="text-3xl font-bold">{dashboardData.waitlistCount}</p>
                <p className="text-sm text-gray-500">Total signups</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <BanknoteIcon className="h-5 w-5 text-green-500" />
                Est. Monthly Revenue
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col">
                <p className="text-3xl font-bold">€{calculateMRR().toLocaleString()}</p>
                <p className="text-sm text-gray-500">
                  From {dashboardData.waitlistCount} members
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <CalendarIcon className="h-5 w-5 text-purple-500" />
                Est. Annual Revenue
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col">
                <p className="text-3xl font-bold">€{calculateARR().toLocaleString()}</p>
                <p className="text-sm text-gray-500">Annual projection</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <TrendingUpIcon className="h-5 w-5 text-orange-500" />
                YTD Revenue
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col">
                <p className="text-3xl font-bold">€{calculateYTDRevenue().toLocaleString()}</p>
                <p className="text-sm text-gray-500">Since March 1st, 2025</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Customer Lists */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Customer Overview</CardTitle>
                <p className="text-sm text-gray-500 mt-1">
                  Current waitlist and customer status
                </p>
              </div>
              <Button onClick={downloadCSV} className="flex items-center gap-2">
                <Download className="h-4 w-4" />
                Export CSV
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-8">
              <CustomerList 
                title="Waitlist Members"
                customers={dashboardData.waitlistCustomers}
                emptyMessage="No customers on the waitlist yet"
              />
              
              <CustomerList 
                title="Canceling Members"
                customers={dashboardData.cancelingCustomers}
                emptyMessage="No canceling members"
              />
              
              <CustomerList 
                title="Interested Members"
                customers={dashboardData.interestedCustomers}
                emptyMessage="No interested members"
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}