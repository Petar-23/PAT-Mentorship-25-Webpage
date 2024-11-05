// src/components/subscription-status.tsx
'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CalendarIcon, CheckCircle2, AlertTriangle, XCircle, Armchair, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { CountdownProgress } from './countdown-progress'

interface SubscriptionStatusProps {
  startDate: string
  status: string
  isPending?: boolean
  isCanceled?: boolean
  cancelAt?: string | null
}

type StatusVariant = 'success' | 'canceled' | 'processing' | 'unknown'

interface StatusDisplay {
  icon: React.ReactNode
  text: string
  description: string
  subDescription?: string
  showAlert?: boolean
  showCountdown?: boolean
  variant: StatusVariant
}

export function SubscriptionStatus({ 
  startDate, 
  status, 
  isPending,
  isCanceled,
  cancelAt
}: SubscriptionStatusProps) {
  const [isLoading, setIsLoading] = useState(false)

  const handleReactivate = async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/create-portal-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Error accessing customer portal')
      }

      window.location.href = data.url
    } catch (error) {
      console.error('Portal access error:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const formattedDate = new Date(startDate).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const getStatusDisplay = (): StatusDisplay => {
    // Check for cancellation
    if (isCanceled || status === 'canceled' || cancelAt) {
      return {
        icon: <XCircle className="h-5 w-5 text-red-500" />,
        text: 'Subscription Canceled',
        description: 'Your spot is no longer reserved',
        showAlert: true,
        showCountdown: false,
        variant: 'canceled'
      }
    }

    // Check for active or trialing subscription (seat reserved)
    if (status === 'active' || status === 'trialing') {
      return {
        icon: <Armchair className="h-5 w-5 text-emerald-500" />,
        text: '🎉 Seat Reserved!',
        description: 'Your spot in the mentorship program is secured',
        subDescription: `The program begins on ${formattedDate}`,
        showCountdown: true,
        showAlert: false,
        variant: 'success'
      }
    }

    // Check for pending subscription
    if (isPending || status === 'incomplete') {
      return {
        icon: <Clock className="h-5 w-5 text-yellow-500" />,
        text: 'Subscription Processing',
        description: 'Your subscription is being processed',
        showAlert: false,
        showCountdown: false,
        variant: 'processing'
      }
    }

    // Default/unknown status
    return {
      icon: <AlertTriangle className="h-5 w-5 text-gray-500" />,
      text: `Status: ${status}`,
      description: 'Please contact support',
      showAlert: false,
      showCountdown: false,
      variant: 'unknown'
    }
  }

  const statusDisplay = getStatusDisplay()

  const getCardClass = () => {
    switch (statusDisplay.variant) {
      case 'success':
        return 'bg-emerald-50 border-emerald-100'
      case 'canceled':
        return 'bg-red-50 border-red-100'
      case 'processing':
        return 'bg-yellow-50 border-yellow-100'
      default:
        return 'bg-gray-50'
    }
  }

  const renderContent = () => {
    if (statusDisplay.variant === 'success') {
      return (
        <div className="space-y-4">
          <div className="flex items-start gap-2 bg-emerald-100/50 rounded-lg p-4">
            <CheckCircle2 className="h-5 w-5 text-emerald-500 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-emerald-800">
                {statusDisplay.description}
              </p>
              <p className="text-sm text-emerald-600">
                {statusDisplay.subDescription}
              </p>
            </div>
          </div>
          {statusDisplay.showCountdown && (
            <div className="pt-2">
              <p className="text-sm text-emerald-600 mb-2">Time until program start:</p>
              <CountdownProgress startDate={startDate} />
            </div>
          )}
        </div>
      )
    }

    return (
      <>
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <CalendarIcon className="h-4 w-4" />
          {statusDisplay.description}
        </div>
        {statusDisplay.showCountdown && (
          <CountdownProgress startDate={startDate} />
        )}
      </>
    )
  }

  return (
    <Card className={getCardClass()}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          {statusDisplay.icon}
          <span className={statusDisplay.variant === 'success' ? 'text-emerald-700' : ''}>
            {statusDisplay.text}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {renderContent()}

        {statusDisplay.showAlert && (
          <div className="mt-4 bg-red-100 border border-red-200 rounded-lg p-4">
            <div className="flex items-start">
              <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5 mr-2" />
              <div>
                <h4 className="text-sm font-medium text-red-800">Limited Spots Available</h4>
                <p className="text-sm text-red-700 mt-1">
                  Due to high demand, there is a risk your spot will be taken by another student. 
                  Reactivate your subscription now to secure your position in the program.
                </p>
                <Button 
                  onClick={handleReactivate}
                  className="mt-3 bg-red-600 hover:bg-red-700"
                  size="sm"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <LoadingSpinner className="mr-2 h-4 w-4" />
                      Processing...
                    </>
                  ) : (
                    'Reactivate Subscription'
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}