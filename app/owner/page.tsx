'use client'

import { useUser } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useCallback } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Download, Users, BanknoteIcon, CalendarIcon, TrendingUpIcon, ChevronDown } from 'lucide-react'
import { DashboardSkeleton } from '@/components/skeletons/admin-dashboard-skeleton'
import { motion, AnimatePresence } from 'framer-motion'
import { LucideIcon } from 'lucide-react';

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
  const [activeSection, setActiveSection] = useState<string | null>(null)

  const isAdmin = user?.organizationMemberships?.some(
    membership => membership.role === 'org:admin'
  )

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
      const response = await fetch('/api/owner/customers')
      
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

  const calculateMRR = () => dashboardData.monthlyPrice * dashboardData.waitlistCount
  const calculateARR = () => calculateMRR() * 12
  const calculateYTDRevenue = () => {
    const now = new Date()
    const startDate = new Date(2025, 2, 1)
    if (now < startDate) return 0
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

  // Stat Card Component
  const StatCard = ({ icon: Icon, title, value, subtitle }: {
    icon: LucideIcon;
    title: string;
    value: string;
    subtitle: string;
  }) => (
    <Card className="relative overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
          <Icon className="h-5 w-5" />
          <span className="line-clamp-1">{title}</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col">
          <p className="text-2xl sm:text-3xl font-bold">{value}</p>
          <p className="text-xs sm:text-sm text-gray-500">{subtitle}</p>
        </div>
      </CardContent>
    </Card>
  )

  // Customer List Component with Accordion
  const CustomerList = ({ title, customers, emptyMessage }: { 
    title: string;
    customers: Customer[];
    emptyMessage: string;
  }) => {
    const isOpen = activeSection === title
    
    return (
      <div className="space-y-2">
        <button
          onClick={() => setActiveSection(isOpen ? null : title)}
          className="w-full flex items-center justify-between p-2 hover:bg-gray-50 rounded-lg transition-colors"
        >
          <h3 className="font-semibold text-lg">{title} ({customers.length})</h3>
          <ChevronDown 
            className={`h-5 w-5 transition-transform ${isOpen ? 'rotate-180' : ''}`} 
          />
        </button>
        
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              {customers.length === 0 ? (
                <p className="text-sm text-gray-500 italic p-4">{emptyMessage}</p>
              ) : (
                <div className="grid gap-3 p-2">
                  {customers.map((customer, index) => (
                    <div key={index} className="flex flex-col p-3 bg-gray-50 rounded-lg">
                      <p className="font-medium break-all">{customer.email}</p>
                      <div className="flex flex-wrap gap-2 items-center mt-2">
                        <p className="text-xs text-gray-500">
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
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    )
  }

  if (!isLoaded || isLoading) {
    return <DashboardSkeleton />
  }

  if (!isAdmin) {
    return null
  }

  if (error) {
    return (
      <div className="container mx-auto py-6 px-4">
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
    <div className="container mx-auto py-6 px-4">
      <div className="grid gap-4">
        {/* Revenue Overview Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <StatCard
            icon={Users}
            title="Waitlist Members"
            value={dashboardData.waitlistCount.toString()}
            subtitle="Total signups"
          />
          <StatCard
            icon={BanknoteIcon}
            title="Monthly Revenue"
            value={`€${calculateMRR().toLocaleString()}`}
            subtitle={`From ${dashboardData.waitlistCount} members`}
          />
          <StatCard
            icon={CalendarIcon}
            title="Annual Revenue"
            value={`€${calculateARR().toLocaleString()}`}
            subtitle="Annual projection"
          />
          <StatCard
            icon={TrendingUpIcon}
            title="YTD Revenue"
            value={`€${calculateYTDRevenue().toLocaleString()}`}
            subtitle="Since March 1st, 2025"
          />
        </div>

        {/* Customer Lists */}
        <Card className="mt-4">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <CardTitle>Customer Overview</CardTitle>
                <p className="text-sm text-gray-500 mt-1">
                  Current waitlist and customer status
                </p>
              </div>
              <Button 
                onClick={downloadCSV} 
                className="w-full sm:w-auto flex items-center justify-center gap-2"
              >
                <Download className="h-4 w-4" />
                Export CSV
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
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