// src/app/admin/page.tsx
'use client'

import { useUser } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useCallback } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Download, Users } from 'lucide-react'

interface Customer {
  email: string;
  createdAt: string;
  metadata?: {
    firstName?: string;
    lastName?: string;
  };
}

export default function AdminDashboard() {
  const { user, isSignedIn, isLoaded } = useUser()
  const router = useRouter()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const isAdmin = user?.publicMetadata?.role === 'admin'

  const fetchCustomers = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/customers')
      const data = await response.json()
      setCustomers(data.customers)
    } catch (error) {
      console.error('Error fetching customers:', error)
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

  const downloadCSV = () => {
    const csvContent = [
      ['Email', 'Joined', 'First Name', 'Last Name'].join(','),
      ...customers.map(customer => [
        customer.email,
        new Date(customer.createdAt).toLocaleDateString(),
        customer.metadata?.firstName || '',
        customer.metadata?.lastName || ''
      ].join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.setAttribute('hidden', '')
    a.setAttribute('href', url)
    a.setAttribute('download', `waitlist-${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  if (!isLoaded || isLoading) {
    return <div>Loading...</div>
  }

  if (!isAdmin) {
    return null
  }

  return (
    <div className="container mx-auto py-10">
      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-2xl">Waitlist Overview</CardTitle>
              <Button onClick={downloadCSV} className="flex items-center gap-2">
                <Download className="h-4 w-4" />
                Export CSV
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4">
              <div className="flex items-center gap-4">
                <Users className="h-8 w-8 text-blue-500" />
                <div>
                  <p className="text-3xl font-bold">{customers.length}</p>
                  <p className="text-gray-500">Total Signups</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Signups</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4">
              {customers.slice(0, 5).map((customer, index) => (
                <div key={index} className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium">{customer.email}</p>
                    <p className="text-sm text-gray-500">
                      Joined {new Date(customer.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}