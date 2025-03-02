// components/dashboard/AdminDashboard.tsx
'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { Bar, XAxis, YAxis, CartesianGrid, Tooltip, TooltipProps, Legend, PieChart, Pie, Cell, ResponsiveContainer, Line, ComposedChart } from 'recharts'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { FilterX, TrendingUp, Calendar, AlertCircle, CreditCard, ArrowUpCircle, Wallet, Users } from 'lucide-react'

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d']

// Constants for revenue calculations
const NET_PRICE_PER_MONTH = 147.25; // EUR

// Core interfaces
interface CustomerData {
  id: string;
  email: string | null;
  name: string | null;
  createdAt: string;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  totalSpend: number;
  pendingAmounts: number;
  paymentCount: number;
  currency: string;
  subscriptionStartDate: string | null;
  subscriptionEndDate: string | null;
}

interface DashboardData {
  customers: CustomerData[];
  customerGroups: {
    active: CustomerData[];
    cancelled: CustomerData[];
    interested: CustomerData[];
  };
  stats: {
    totalCustomers: number;
    activeCustomers: number;
    cancelledCustomers: number;
    interestedCustomers: number;
    confirmedRevenue: number;
    pendingRevenue: number;
    totalRevenue: number;
    pendingPaymentsCount: number;
  };
  paymentMethodData: Array<{
    name: string;
    value: number;
    revenue: number;
    pendingRevenue: number;
  }>;
  monthlyData: Array<{
    month: string;
    newCustomers: number;
    confirmedRevenue: number;
    pendingRevenue: number;
    totalRevenue: number;
    totalCustomersToDate: number;
  }>;
}

export default function AdminDashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCustomerType, setSelectedCustomerType] = useState('active')
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('All')
  const [sortConfig, setSortConfig] = useState<{ key: keyof CustomerData; direction: 'asc' | 'desc' }>({ 
    key: 'createdAt', 
    direction: 'desc' 
  })

  // Fetch dashboard data
  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setIsLoading(true)
        setError(null)
        
        const response = await fetch('/api/owner/dashboard-data', {
          cache: 'no-store'
        })
        
        if (!response.ok) {
          throw new Error(`Error: ${response.status} - ${response.statusText}`)
        }
        
        const dashboardData = await response.json() as DashboardData
        setData(dashboardData)
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error)
        setError(error instanceof Error 
          ? `Failed to load dashboard data: ${error.message}` 
          : 'Failed to load dashboard data. Please try again later.'
        )
      } finally {
        setIsLoading(false)
      }
    }

    fetchDashboardData()
  }, [])

  // Helper to sort and filter customers
  const filteredCustomers = useMemo(() => {
    if (!data) return []
    
    // Get the appropriate customer list based on selected type
    let customerList: CustomerData[] = []
    switch (selectedCustomerType) {
      case 'active':
        customerList = data.customerGroups.active
        break
      case 'cancelled':
        customerList = data.customerGroups.cancelled
        break
      case 'interested':
        customerList = data.customerGroups.interested
        break
      default:
        customerList = data.customers
    }
    
    // Apply search filter
    let filtered = [...customerList]
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
    
    // Apply sorting
    return [...filtered].sort((a, b) => {
      const key = sortConfig.key;
      
      // Handle numeric fields
      if (key === 'totalSpend' || key === 'paymentCount' || key === 'pendingAmounts') {
        const aVal = a[key] || 0;
        const bVal = b[key] || 0;
        return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
      }
      
      // Handle date fields
      if (key === 'createdAt' || key === 'subscriptionStartDate' || key === 'subscriptionEndDate') {
        const aDate = a[key] ? new Date(a[key]).getTime() : 0;
        const bDate = b[key] ? new Date(b[key]).getTime() : 0;
        return sortConfig.direction === 'asc' ? aDate - bDate : bDate - aDate;
      }
      
      // Handle string fields with null check
      const aValue = a[key] || '';
      const bValue = b[key] || '';
      return sortConfig.direction === 'asc'
        ? String(aValue).localeCompare(String(bValue))
        : String(bValue).localeCompare(String(aValue));
    });
  }, [data, searchTerm, selectedPaymentMethod, sortConfig, selectedCustomerType])

  // Calculate revenue projections
  const revenueProjections = useMemo(() => {
    if (!data) return { monthly: 0, yearly: 0 };
    
    const activeCustomers = data.stats.activeCustomers;
    const expectedMonthlyRevenue = activeCustomers * NET_PRICE_PER_MONTH;
    
    return {
      monthly: expectedMonthlyRevenue,
      yearly: expectedMonthlyRevenue * 12
    };
  }, [data]);

  // Get payment method options
  const paymentMethodOptions = useMemo(() => {
    if (!data) return ['All']
    const methods = [...new Set(data.customers.map(c => c.paymentMethod))]
    return ['All', ...methods]
  }, [data]);

  const formatCurrency = (value: number): string => {
    return `€${value.toFixed(2)}`
  }

  // Tooltip content renderer that matches Recharts' expected signature
  const renderTooltipContent = (props: TooltipProps<number, string>) => {
    const { active, payload, label } = props;
    
    if (active && payload && payload.length > 0) {
      return (
        <div className="bg-white p-3 border rounded-md shadow-md">
          <p className="text-sm font-medium">{label}</p>
          {payload.map((entry, index) => (
            <p key={index} className="text-sm" style={{ color: entry.color || '#000' }}>
              {entry.name || 'Unknown'}: {
                entry.name && entry.name.includes('Revenue') && typeof entry.value === 'number' 
                  ? formatCurrency(entry.value) 
                  : entry.value
              }
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  // Handle sort change
  const handleSort = (key: keyof CustomerData) => {
    let direction: 'asc' | 'desc' = 'asc'
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc'
    }
    setSortConfig({ key, direction })
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-64 w-full py-20">
        <div className="text-center">
          <LoadingSpinner className="h-10 w-10 mx-auto" />
          <p className="mt-4 text-lg text-gray-700">Loading dashboard data...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6 max-w-4xl mx-auto mt-8">
        <Card className="bg-red-50 border-red-300">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <AlertCircle className="h-6 w-6 text-red-600 flex-shrink-0 mt-1" />
              <div>
                <h3 className="text-lg font-semibold text-red-800 mb-2">Error Loading Dashboard</h3>
                <p className="text-red-700 mb-4">{error}</p>
                <button 
                  onClick={() => window.location.reload()}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
                >
                  Try Again
                </button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!data) return null

  return (
    <div className="p-6 bg-gray-50">
      <h1 className="text-2xl font-bold mb-6">Program Management Dashboard</h1>
      
      {/* Summary Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6 flex items-start gap-4">
            <div className="p-2 rounded-lg bg-blue-50">
              <Users className="h-6 w-6 text-blue-500" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Active Customers</p>
              <p className="text-2xl font-bold">{data.stats.activeCustomers}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex items-start gap-4">
            <div className="p-2 rounded-lg bg-amber-50">
              <Wallet className="h-6 w-6 text-amber-500" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Confirmed Revenue</p>
              <p className="text-2xl font-bold">{formatCurrency(data.stats.confirmedRevenue)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex items-start gap-4">
            <div className="p-2 rounded-lg bg-orange-50">
              <CreditCard className="h-6 w-6 text-orange-500" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Pending Payments</p>
              <p className="text-2xl font-bold">{formatCurrency(data.stats.pendingRevenue)}</p>
              <p className="text-xs text-gray-400">{data.stats.pendingPaymentsCount} customers</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex items-start gap-4">
            <div className="p-2 rounded-lg bg-green-50">
              <ArrowUpCircle className="h-6 w-6 text-green-500" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Revenue</p>
              <p className="text-2xl font-bold">{formatCurrency(data.stats.totalRevenue)}</p>
              <p className="text-xs text-gray-400">Confirmed + Pending</p>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Projections */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <Card className="relative overflow-hidden">
          <div className="absolute top-0 right-0 mt-2 mr-2">
            <div className="px-2 py-1 rounded-full bg-green-100 text-green-800 text-xs font-medium">
              Projected
            </div>
          </div>
          <CardContent className="pt-6 flex items-start gap-4">
            <div className="p-2 rounded-lg bg-green-50">
              <TrendingUp className="h-6 w-6 text-green-500" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Monthly Revenue</p>
              <p className="text-2xl font-bold">{formatCurrency(revenueProjections.monthly)}</p>
              <p className="text-xs text-gray-400">Based on current active customers</p>
            </div>
          </CardContent>
        </Card>
        <Card className="relative overflow-hidden">
          <div className="absolute top-0 right-0 mt-2 mr-2">
            <div className="px-2 py-1 rounded-full bg-blue-100 text-blue-800 text-xs font-medium">
              Projected
            </div>
          </div>
          <CardContent className="pt-6 flex items-start gap-4">
            <div className="p-2 rounded-lg bg-blue-50">
              <Calendar className="h-6 w-6 text-blue-500" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Yearly Revenue</p>
              <p className="text-2xl font-bold">{formatCurrency(revenueProjections.yearly)}</p>
              <p className="text-xs text-gray-400">Annualized from monthly revenue</p>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Payment Method Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Payment Method Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              {data.paymentMethodData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data.paymentMethodData}
                      cx="50%"
                      cy="50%"
                      labelLine={true}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {data.paymentMethodData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value, name, props) => {
                        const entry = props.payload;
                        return [
                          `${value} customers (${formatCurrency(entry.revenue as number)})`, 
                          name
                        ];
                      }} 
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center">
                  <p className="text-gray-500">No payment method data available</p>
                </div>
              )}
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
              {data.monthlyData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={data.monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis tickFormatter={(value) => `€${value}`} />
                    <Tooltip content={renderTooltipContent} />
                    <Legend />
                    <Bar stackId="a" dataKey="confirmedRevenue" name="Confirmed Revenue" fill="#00C49F" />
                    <Bar stackId="a" dataKey="pendingRevenue" name="Pending Revenue" fill="#FFBB28" />
                    <Line type="monotone" dataKey="totalRevenue" name="Total Revenue" stroke="#8884d8" strokeWidth={2} />
                  </ComposedChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center">
                  <p className="text-gray-500">No revenue data available yet</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Customer Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Customer Management</span>
            <div className="flex gap-2">
              <button
                onClick={() => setSelectedCustomerType('active')}
                className={`px-3 py-1 text-sm rounded-lg ${
                  selectedCustomerType === 'active' 
                    ? 'bg-blue-100 text-blue-700 font-medium' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Active ({data.stats.activeCustomers})
              </button>
              <button
                onClick={() => setSelectedCustomerType('cancelled')}
                className={`px-3 py-1 text-sm rounded-lg ${
                  selectedCustomerType === 'cancelled' 
                    ? 'bg-red-100 text-red-700 font-medium' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Cancelled ({data.stats.cancelledCustomers})
              </button>
              <button
                onClick={() => setSelectedCustomerType('interested')}
                className={`px-3 py-1 text-sm rounded-lg ${
                  selectedCustomerType === 'interested' 
                    ? 'bg-purple-100 text-purple-700 font-medium' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Interested ({data.stats.interestedCustomers})
              </button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Filter Controls */}
          <div className="bg-gray-50 p-4 rounded-lg mb-6">
            <div className="flex flex-col md:flex-row gap-4 items-center">
              <div className="flex-1">
                <input
                  type="text"
                  placeholder="Search by name or email"
                  className="w-full px-3 py-2 border rounded-lg"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              {selectedCustomerType !== 'interested' && (
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
              )}
              <button
                onClick={() => {
                  setSearchTerm('');
                  setSelectedPaymentMethod('All');
                }}
                className="px-3 py-2 flex items-center gap-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                title="Clear all filters"
              >
                <FilterX className="h-4 w-4" />
                <span>Clear</span>
              </button>
            </div>
          </div>
          
          {/* Customer Table */}
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
                    onClick={() => handleSort('paymentStatus')}
                  >
                    Payment Status
                    {sortConfig.key === 'paymentStatus' && (
                      <span className="ml-1">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </th>
                  {selectedCustomerType !== 'interested' && (
                    <>
                      <th 
                        className="px-4 py-2 text-right cursor-pointer hover:bg-gray-200"
                        onClick={() => handleSort('totalSpend')}
                      >
                        Confirmed
                        {sortConfig.key === 'totalSpend' && (
                          <span className="ml-1">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </th>
                      <th 
                        className="px-4 py-2 text-right cursor-pointer hover:bg-gray-200"
                        onClick={() => handleSort('pendingAmounts')}
                      >
                        Pending
                        {sortConfig.key === 'pendingAmounts' && (
                          <span className="ml-1">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </th>
                    </>
                  )}
                  <th 
                    className="px-4 py-2 text-left cursor-pointer hover:bg-gray-200"
                    onClick={() => handleSort('createdAt')}
                  >
                    Account Created
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
                        customer.paymentStatus.includes('Paid') ? 'bg-green-100 text-green-800' : 
                        customer.paymentStatus.includes('Pending') ? 'bg-yellow-100 text-yellow-800' :
                        customer.paymentStatus.includes('Cancelled') ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {customer.paymentStatus}
                      </span>
                    </td>
                    {selectedCustomerType !== 'interested' && (
                      <>
                        <td className="px-4 py-2 text-right">
                          <span className={`font-medium ${customer.totalSpend > 0 ? 'text-green-600' : ''}`}>
                            {formatCurrency(customer.totalSpend)}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-right">
                          <span className={`font-medium ${customer.pendingAmounts > 0 ? 'text-amber-600' : ''}`}>
                            {formatCurrency(customer.pendingAmounts)}
                          </span>
                        </td>
                      </>
                    )}
                    <td className="px-4 py-2">{new Date(customer.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
                {filteredCustomers.length === 0 && (
                  <tr>
                    <td colSpan={selectedCustomerType === 'interested' ? 4 : 6} className="px-4 py-4 text-center text-gray-500">
                      No customers found matching your filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="mt-4 text-sm text-gray-500">
            Showing {filteredCustomers.length} of {
              selectedCustomerType === 'active' ? data.customerGroups.active.length :
              selectedCustomerType === 'cancelled' ? data.customerGroups.cancelled.length :
              data.customerGroups.interested.length
            } customers
          </div>
        </CardContent>
      </Card>
    </div>
  )
}