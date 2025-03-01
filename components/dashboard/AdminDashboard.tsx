// components/dashboard/AdminDashboard.tsx
'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell, ResponsiveContainer, LineChart, Line } from 'recharts'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, ChevronUp, FilterX, TrendingUp, Calendar } from 'lucide-react'

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d']

// Define constants for revenue calculations
const GROSS_PRICE_PER_MONTH = 150.00; // EUR
const NET_PRICE_PER_MONTH = 147.25; // EUR

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

interface PaymentMethodData {
  name: string;
  value: number;
  revenue: number;
}

interface MonthlyData {
  month: string;
  newCustomers: number;
  revenue: number;
}

interface DashboardData {
  customers: CustomerData[];
  stats: {
    totalCustomers: number;
    activeCustomers: number;
    paidCustomers: number;
    totalRevenue: number;
  };
  paymentMethodData: PaymentMethodData[];
  monthlyData: MonthlyData[];
}

export default function AdminDashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [showInactiveCustomers, setShowInactiveCustomers] = useState(false)
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('All')
  const [sortConfig, setSortConfig] = useState<{ key: keyof CustomerData; direction: 'asc' | 'desc' }>({ 
    key: 'createdAt', 
    direction: 'desc' 
  })
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({
    name: '',
    email: '',
    status: '',
    paymentStatus: '',
    paymentMethod: '',
    totalSpend: ''
  })
  const [showCancelledSection, setShowCancelledSection] = useState(false)
  const [showColumnFilters, setShowColumnFilters] = useState(false)

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setIsLoading(true)
        const response = await fetch('/api/owner/dashboard-data')
        
        if (!response.ok) {
          throw new Error(`Error: ${response.status}`)
        }
        
        const dashboardData = await response.json() as DashboardData
        setData(dashboardData)
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error)
        setError(error instanceof Error ? error.message : 'Failed to load dashboard data')
      } finally {
        setIsLoading(false)
      }
    }

    fetchDashboardData()
  }, [])

  const handleSort = (key: keyof CustomerData) => {
    let direction: 'asc' | 'desc' = 'asc'
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc'
    }
    setSortConfig({ key, direction })
  }

  const handleColumnFilterChange = (column: string, value: string) => {
    setColumnFilters(prev => ({
      ...prev,
      [column]: value
    }))
  }

  const clearAllFilters = () => {
    setColumnFilters({
      name: '',
      email: '',
      status: '',
      paymentStatus: '',
      paymentMethod: '',
      totalSpend: ''
    })
    setSearchTerm('')
    setSelectedPaymentMethod('All')
  }

  const filteredCustomers = useMemo(() => {
    if (!data) return []
    
    let filtered = [...data.customers]
    
    // Apply active/inactive filter
    if (!showInactiveCustomers) {
      filtered = filtered.filter(customer => customer.status === 'active')
    }
    
    // Apply search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase()
      filtered = filtered.filter(customer => 
        (customer.name && customer.name.toLowerCase().includes(searchLower)) ||
        (customer.email && customer.email.toLowerCase().includes(searchLower))
      )
    }
    
    // Apply payment method filter
    if (selectedPaymentMethod !== 'All') {
      filtered = filtered.filter(customer => 
        customer.paymentMethod === selectedPaymentMethod
      )
    }
    
    // Apply column filters
    Object.entries(columnFilters).forEach(([column, value]) => {
      if (value) {
        filtered = filtered.filter(customer => {
          const customerValue = customer[column as keyof CustomerData];
          if (customerValue === null || customerValue === undefined) return false;
          
          if (typeof customerValue === 'number') {
            return customerValue.toString().includes(value);
          }
          return customerValue.toString().toLowerCase().includes(value.toLowerCase());
        });
      }
    });
    
    // Apply sorting
    const sorted = [...filtered].sort((a, b) => {
      const key = sortConfig.key;
      
      // Handle numeric fields with safe type checking
      if (key === 'totalSpend' || key === 'paymentCount') {
        const aVal = a[key] || 0;  // Default to 0 if null
        const bVal = b[key] || 0;  // Default to 0 if null
        
        return sortConfig.direction === 'asc' 
          ? aVal - bVal
          : bVal - aVal;
      }
      
      // Handle string fields
      const aValue = a[key];
      const bValue = b[key];
      
      // Handle string comparisons with null checks
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortConfig.direction === 'asc'
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }
      
      // Safe comparison for potentially null values
      // First, handle cases where either value is null
      if (aValue === null && bValue !== null) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue !== null && bValue === null) return sortConfig.direction === 'asc' ? 1 : -1;
      if (aValue === null && bValue === null) return 0;
      
      // Now both values are not null, can do direct comparison
      // Convert to strings for safe comparison of different types
      const aStr = String(aValue);
      const bStr = String(bValue);
      
      return sortConfig.direction === 'asc'
        ? aStr.localeCompare(bStr)
        : bStr.localeCompare(aStr);
    });
    
    return sorted;
  }, [data, searchTerm, showInactiveCustomers, selectedPaymentMethod, sortConfig, columnFilters])

  // Get cancelled members
  const cancelledMembers = useMemo(() => {
    if (!data) return [];
    
    return data.customers
      .filter(c => c.status === 'inactive' || c.paymentStatus.includes('Inactive'))
      .map(c => {
        // Estimate cancellation date and duration using the available data
        const creationDate = new Date(c.createdAt);
        const today = new Date();
        
        // For inactive customers, we'll try to estimate when they might have cancelled
        // For a real application, you would get this from your Stripe subscription data
        let estimatedCancellationDate = new Date(c.createdAt);
        
        // Estimate based on payment count - assume each payment is for 1 month
        if (c.paymentCount > 0) {
          estimatedCancellationDate = new Date(creationDate);
          estimatedCancellationDate.setMonth(estimatedCancellationDate.getMonth() + c.paymentCount);
          
          // If estimated date is in the future, set it to 1 month before today
          if (estimatedCancellationDate > today) {
            estimatedCancellationDate = new Date(today);
            estimatedCancellationDate.setMonth(estimatedCancellationDate.getMonth() - 1);
          }
        } else {
          // If no payments, assume cancelled shortly after creation
          estimatedCancellationDate = new Date(creationDate);
          estimatedCancellationDate.setDate(estimatedCancellationDate.getDate() + 14); // 2 weeks later
          
          // If that's in the future, set it to now
          if (estimatedCancellationDate > today) {
            estimatedCancellationDate = new Date(today);
          }
        }
        
        // Calculate subscription duration from creation to estimated cancellation
        const subscriptionDuration = Math.floor(
          (estimatedCancellationDate.getTime() - creationDate.getTime()) / (1000 * 60 * 60 * 24)
        );
        
        // Get reason based on status and payment history
        let cancellationReason = "Unknown";
        if (c.paymentStatus.includes("Failed")) {
          cancellationReason = "Payment Failed";
        } else if (c.paymentCount === 0) {
          cancellationReason = "Never Started";
        } else {
          cancellationReason = "Didn't Renew";
        }
        
        return {
          id: c.id,
          email: c.email,
          name: c.name,
          createdAt: c.createdAt,
          estimatedCancellationDate: estimatedCancellationDate.toISOString(),
          totalSpent: c.totalSpend,
          paymentCount: c.paymentCount,
          subscriptionDuration: subscriptionDuration,
          cancellationReason: cancellationReason
        };
      })
      .sort((a, b) => new Date(b.estimatedCancellationDate).getTime() - new Date(a.estimatedCancellationDate).getTime());
  }, [data]);

  // Calculate metrics for cancelled members
  const cancelledMetrics = useMemo(() => {
    if (cancelledMembers.length === 0) return null;
    
    const totalRevenue = cancelledMembers.reduce((sum, member) => sum + member.totalSpent, 0);
    const averageDuration = cancelledMembers.reduce((sum, member) => sum + member.subscriptionDuration, 0) / cancelledMembers.length;
    const averageSpend = totalRevenue / cancelledMembers.length;
    
    return {
      count: cancelledMembers.length,
      totalRevenue,
      averageDuration: Math.round(averageDuration),
      averageSpend
    };
  }, [cancelledMembers]);

  // Calculate revenue projections
  const revenueProjections = useMemo(() => {
    if (!data) return { monthly: 0, yearly: 0 };
    
    const activeCustomers = data.stats.activeCustomers;
    const expectedMonthlyRevenue = activeCustomers * NET_PRICE_PER_MONTH;
    const expectedYearlyRevenue = expectedMonthlyRevenue * 12;
    
    return {
      monthly: expectedMonthlyRevenue,
      yearly: expectedYearlyRevenue
    };
  }, [data]);

  // Filter charts data based on active/inactive filter
  const filteredChartData = useMemo(() => {
    if (!data) return null
    
    // Filter payment method data
    const filteredPaymentMethodData = data.paymentMethodData.map(item => {
      // If showing all customers, use original data
      if (showInactiveCustomers) return item
      
      // Otherwise, filter to only include active customers
      const activeCustomersWithThisMethod = data.customers.filter(
        c => c.status === 'active' && c.paymentMethod === item.name
      ).length
      
      return {
        ...item,
        value: activeCustomersWithThisMethod
      }
    })
    
    // Filter monthly data to only show from March 2025 onwards
    const programStartDate = new Date('2025-03-01')
    const filteredMonthlyData = data.monthlyData.filter(
      item => {
        const [year, month] = item.month.split('-').map(Number)
        const itemDate = new Date(year, month - 1)
        return itemDate >= programStartDate
      }
    )
    
    return {
      ...data,
      paymentMethodData: filteredPaymentMethodData,
      monthlyData: filteredMonthlyData
    }
  }, [data, showInactiveCustomers])

  const paymentMethodOptions = useMemo(() => {
    if (!data) return ['All']
    const methods = [...new Set(data.customers.map(c => c.paymentMethod))]
    return ['All', ...methods]
  }, [data])

  const formatCurrency = (value: number): string => {
    return `€${value.toFixed(2)}`
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-64 w-full">
        <div className="text-center">
          <LoadingSpinner className="h-10 w-10 mx-auto" />
          <p className="mt-4 text-lg text-gray-700">Loading dashboard data...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6 text-center">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          <p className="font-bold">Error</p>
          <p>{error}</p>
        </div>
      </div>
    )
  }

  if (!data) return null

  return (
    <div className="p-6 bg-gray-50">
      <h1 className="text-2xl font-bold mb-6">Customer Dashboard</h1>
      
      {/* Summary Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-500">Total Customers</p>
            <p className="text-2xl font-bold">
              {showInactiveCustomers ? data.stats.totalCustomers : data.stats.activeCustomers}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-500">Active Customers</p>
            <p className="text-2xl font-bold">{data.stats.activeCustomers}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-500">Inactive Customers</p>
            <p className="text-2xl font-bold">{data.stats.totalCustomers - data.stats.activeCustomers}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-500">Total Revenue</p>
            <p className="text-2xl font-bold">{formatCurrency(data.stats.totalRevenue)}</p>
          </CardContent>
        </Card>
      </div>
      
      {/* Revenue Projections */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <Card className="bg-green-50 border-green-100">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center text-green-800">
              <TrendingUp className="mr-2 h-5 w-5 text-green-600" />
              Expected Monthly Revenue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end justify-between">
              <div>
                <p className="text-3xl font-bold text-green-700">
                  {formatCurrency(revenueProjections.monthly)}
                </p>
                <p className="text-sm text-green-600 mt-1">
                  Based on {data.stats.activeCustomers} active customers at {formatCurrency(NET_PRICE_PER_MONTH)}/month
                </p>
              </div>
              <div className="bg-white p-2 rounded-lg border border-green-200">
                <p className="text-xs text-gray-500">Gross per customer</p>
                <p className="text-sm font-medium">{formatCurrency(GROSS_PRICE_PER_MONTH)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-blue-50 border-blue-100">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center text-blue-800">
              <Calendar className="mr-2 h-5 w-5 text-blue-600" />
              Expected Yearly Revenue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end justify-between">
              <div>
                <p className="text-3xl font-bold text-blue-700">
                  {formatCurrency(revenueProjections.yearly)}
                </p>
                <p className="text-sm text-blue-600 mt-1">
                  Projected annual revenue at current customer count
                </p>
              </div>
              <div className="bg-white p-2 rounded-lg border border-blue-200">
                <p className="text-xs text-gray-500">Net per customer</p>
                <p className="text-sm font-medium">{formatCurrency(NET_PRICE_PER_MONTH)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Second row of statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-500">Paid Customers</p>
            <p className="text-2xl font-bold">{data.stats.paidCustomers}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-500">Trialing Customers</p>
            <p className="text-2xl font-bold">
              {data.customers.filter(c => c.paymentStatus.includes('Trialing')).length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-500">Payments Pending</p>
            <p className="text-2xl font-bold">
              {data.customers.filter(c => c.paymentStatus.includes('Pending')).length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-500">With Balance Due</p>
            <p className="text-2xl font-bold">
              {data.customers.filter(c => c.paymentStatus.includes('Balance')).length}
            </p>
          </CardContent>
        </Card>
      </div>
      
      {/* Charts */}
      {filteredChartData && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Payment Method Distribution */}
          <Card>
            <CardHeader>
              <CardTitle>Payment Method Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={filteredChartData.paymentMethodData}
                      cx="50%"
                      cy="50%"
                      labelLine={true}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {filteredChartData.paymentMethodData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => [`${value} customers`, 'Count']} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
          
          {/* Customer Growth */}
          <Card>
            <CardHeader>
              <CardTitle>Customer Growth by Month (From March 2025)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={filteredChartData.monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip formatter={(value) => [`${value} customers`, 'New Signups']} />
                    <Legend />
                    <Bar dataKey="newCustomers" name="New Customers" fill="#0088FE" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
          
          {/* Revenue by Month */}
          <Card>
            <CardHeader>
              <CardTitle>Revenue by Month (From March 2025)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={filteredChartData.monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis tickFormatter={(value) => `€${value}`} />
                    <Tooltip formatter={(value: number) => [formatCurrency(value), 'Revenue']} />
                    <Legend />
                    <Line type="monotone" dataKey="revenue" name="Monthly Revenue" stroke="#00C49F" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
      
      {/* Cancelled Members Checkbox */}
      <div className="mb-6 flex items-center gap-2">
        <input
          type="checkbox"
          id="showCancelledMembers"
          checked={showCancelledSection}
          onChange={() => setShowCancelledSection(!showCancelledSection)}
          className="h-4 w-4"
        />
        <label htmlFor="showCancelledMembers" className="text-purple-700 font-medium">
          Show Cancelled Members Analysis
        </label>
      </div>
      
      {/* Cancelled Members Section */}
      <AnimatePresence>
        {showCancelledSection && cancelledMetrics && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden mb-6"
          >
            <Card className="border-purple-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-purple-700">
                  <span>Cancelled Members Analysis</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {/* Cancelled Members Statistics */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                  <div className="bg-purple-50 rounded-lg p-4">
                    <p className="text-sm text-purple-600">Total Cancelled</p>
                    <p className="text-2xl font-bold text-purple-800">{cancelledMetrics.count}</p>
                  </div>
                  <div className="bg-purple-50 rounded-lg p-4">
                    <p className="text-sm text-purple-600">Total Revenue</p>
                    <p className="text-2xl font-bold text-purple-800">{formatCurrency(cancelledMetrics.totalRevenue)}</p>
                  </div>
                  <div className="bg-purple-50 rounded-lg p-4">
                    <p className="text-sm text-purple-600">Avg. Duration</p>
                    <p className="text-2xl font-bold text-purple-800">{cancelledMetrics.averageDuration} days</p>
                  </div>
                  <div className="bg-purple-50 rounded-lg p-4">
                    <p className="text-sm text-purple-600">Avg. Spend</p>
                    <p className="text-2xl font-bold text-purple-800">{formatCurrency(cancelledMetrics.averageSpend)}</p>
                  </div>
                </div>
                
                {/* Cancelled Members Table */}
                <div className="overflow-x-auto">
                  <table className="min-w-full border-collapse">
                    <thead>
                      <tr className="bg-purple-50">
                        <th className="px-4 py-2 text-left text-purple-700">Name</th>
                        <th className="px-4 py-2 text-left text-purple-700">Email</th>
                        <th className="px-4 py-2 text-left text-purple-700">Created On</th>
                        <th className="px-4 py-2 text-left text-purple-700">Est. Cancelled On</th>
                        <th className="px-4 py-2 text-right text-purple-700">Duration</th>
                        <th className="px-4 py-2 text-left text-purple-700">Likely Reason</th>
                        <th className="px-4 py-2 text-right text-purple-700">Total Spend</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cancelledMembers.map((member) => (
                        <tr key={member.id} className="border-t hover:bg-purple-50/50">
                          <td className="px-4 py-2">{member.name || '-'}</td>
                          <td className="px-4 py-2">{member.email || '-'}</td>
                          <td className="px-4 py-2">{new Date(member.createdAt).toLocaleDateString()}</td>
                          <td className="px-4 py-2">{new Date(member.estimatedCancellationDate).toLocaleDateString()}</td>
                          <td className="px-4 py-2 text-right">{member.subscriptionDuration} days</td>
                          <td className="px-4 py-2">{member.cancellationReason}</td>
                          <td className="px-4 py-2 text-right">
                            <span className="text-green-600 font-medium">{formatCurrency(member.totalSpent)}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Customer Table */}
      <Card>
        <CardHeader>
          <CardTitle>Customer Details</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Filter Controls */}
          <div className="bg-gray-50 p-4 rounded-lg mb-6">
            <div className="flex flex-col md:flex-row gap-4 items-center mb-4">
              <div className="flex-1">
                <input
                  type="text"
                  placeholder="Search by name or email"
                  className="w-full px-3 py-2 border rounded-lg"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="flex-shrink-0">
                <select
                  className="px-3 py-2 border rounded-lg"
                  value={selectedPaymentMethod}
                  onChange={(e) => setSelectedPaymentMethod(e.target.value)}
                >
                  {paymentMethodOptions.map((method) => (
                    <option key={method} value={method}>{method}</option>
                  ))}
                </select>
              </div>
              <div className="flex-shrink-0 flex items-center gap-2">
                <input
                  type="checkbox"
                  id="showInactive"
                  checked={showInactiveCustomers}
                  onChange={() => setShowInactiveCustomers(!showInactiveCustomers)}
                  className="h-4 w-4"
                />
                <label htmlFor="showInactive">Show Inactive Customers</label>
              </div>
              <button
                onClick={clearAllFilters}
                className="px-3 py-2 flex items-center gap-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                title="Clear all filters"
              >
                <FilterX className="h-4 w-4" />
                <span>Clear</span>
              </button>
            </div>
            
            {/* Column Filters */}
            <div className="flex justify-between items-center">
              <button
                onClick={() => setShowColumnFilters(!showColumnFilters)}
                className="flex items-center gap-2 text-blue-600 hover:text-blue-800 transition-colors text-sm"
              >
                {showColumnFilters ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                <span>{showColumnFilters ? 'Hide column filters' : 'Show column filters'}</span>
              </button>
            </div>
            
            <AnimatePresence>
              {showColumnFilters && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="overflow-hidden"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mt-4 pt-4 border-t">
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Name</label>
                      <input
                        type="text"
                        className="w-full px-3 py-2 border rounded-lg text-sm"
                        placeholder="Filter name..."
                        value={columnFilters.name}
                        onChange={(e) => handleColumnFilterChange('name', e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Email</label>
                      <input
                        type="text"
                        className="w-full px-3 py-2 border rounded-lg text-sm"
                        placeholder="Filter email..."
                        value={columnFilters.email}
                        onChange={(e) => handleColumnFilterChange('email', e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Status</label>
                      <input
                        type="text"
                        className="w-full px-3 py-2 border rounded-lg text-sm"
                        placeholder="Filter status..."
                        value={columnFilters.status}
                        onChange={(e) => handleColumnFilterChange('status', e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Payment Status</label>
                      <input
                        type="text"
                        className="w-full px-3 py-2 border rounded-lg text-sm"
                        placeholder="Filter payment status..."
                        value={columnFilters.paymentStatus}
                        onChange={(e) => handleColumnFilterChange('paymentStatus', e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Payment Method</label>
                      <input
                        type="text"
                        className="w-full px-3 py-2 border rounded-lg text-sm"
                        placeholder="Filter payment method..."
                        value={columnFilters.paymentMethod}
                        onChange={(e) => handleColumnFilterChange('paymentMethod', e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Total Spend</label>
                      <input
                        type="text"
                        className="w-full px-3 py-2 border rounded-lg text-sm"
                        placeholder="Filter spend..."
                        value={columnFilters.totalSpend}
                        onChange={(e) => handleColumnFilterChange('totalSpend', e.target.value)}
                      />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse">
              <thead>
                <tr className="bg-gray-100">
                  <th 
                    className="px-4 py-2 text-left cursor-pointer hover:bg-gray-200"
                    onClick={() => handleSort('name')}
                  >
                    Name
                    {sortConfig.key === 'name' && (
                      <span className="ml-1">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </th>
                  <th 
                    className="px-4 py-2 text-left cursor-pointer hover:bg-gray-200"
                    onClick={() => handleSort('email')}
                  >
                    Email
                    {sortConfig.key === 'email' && (
                      <span className="ml-1">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </th>
                  <th 
                    className="px-4 py-2 text-left cursor-pointer hover:bg-gray-200"
                    onClick={() => handleSort('status')}
                  >
                    Status
                    {sortConfig.key === 'status' && (
                      <span className="ml-1">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </th>
                  <th 
                    className="px-4 py-2 text-left cursor-pointer hover:bg-gray-200"
                    onClick={() => handleSort('paymentStatus')}
                  >
                    Payment Status
                    {sortConfig.key === 'paymentStatus' && (
                      <span className="ml-1">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </th>
                  <th 
                    className="px-4 py-2 text-left cursor-pointer hover:bg-gray-200"
                    onClick={() => handleSort('paymentMethod')}
                  >
                    Payment Method
                    {sortConfig.key === 'paymentMethod' && (
                      <span className="ml-1">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </th>
                  <th 
                    className="px-4 py-2 text-right cursor-pointer hover:bg-gray-200"
                    onClick={() => handleSort('totalSpend')}
                  >
                    Total Spend
                    {sortConfig.key === 'totalSpend' && (
                      <span className="ml-1">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </th>
                  <th 
                    className="px-4 py-2 text-right cursor-pointer hover:bg-gray-200"
                    onClick={() => handleSort('paymentCount')}
                  >
                    Payments
                    {sortConfig.key === 'paymentCount' && (
                      <span className="ml-1">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </th>
                  <th 
                    className="px-4 py-2 text-left cursor-pointer hover:bg-gray-200"
                    onClick={() => handleSort('createdAt')}
                  >
                    Created
                    {sortConfig.key === 'createdAt' && (
                      <span className="ml-1">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredCustomers.map((customer) => (
                  <tr key={customer.id} className="border-t hover:bg-gray-50">
                    <td className="px-4 py-2">{customer.name || '-'}</td>
                    <td className="px-4 py-2">{customer.email || '-'}</td>
                    <td className="px-4 py-2">
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        customer.status === 'active' ? 'bg-green-100 text-green-800' : 
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {customer.status}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        customer.paymentStatus.includes('Paid') ? 'bg-green-100 text-green-800' : 
                        customer.paymentStatus.includes('Pending') ? 'bg-yellow-100 text-yellow-800' :
                        customer.paymentStatus.includes('Failed') ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {customer.paymentStatus}
                      </span>
                    </td>
                    <td className="px-4 py-2">{customer.paymentMethod}</td>
                    <td className="px-4 py-2 text-right">
                      <span className={`font-medium ${customer.totalSpend > 0 ? 'text-green-600' : ''}`}>
                        {formatCurrency(customer.totalSpend)}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right">{customer.paymentCount}</td>
                    <td className="px-4 py-2">{new Date(customer.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
                {filteredCustomers.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-4 text-center text-gray-500">
                      No customers found matching your filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="mt-4 text-sm text-gray-500">
            Showing {filteredCustomers.length} of {data.customers.length} customers
          </div>
        </CardContent>
      </Card>
    </div>
  )
}