// src/components/checkout-button.tsx
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { useToast } from "@/hooks/use-toast"

export function CheckoutButton() {
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  const handleCheckout = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/create-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Error creating checkout session')
      }

      if (!data.url) {
        throw new Error('No checkout URL received')
      }

      // Redirect to Stripe Checkout
      window.location.href = data.url
    } catch (error) {
      console.error('Checkout error:', error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to start checkout process',
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button 
      onClick={handleCheckout} 
      disabled={loading}
      className="w-full"
      size="lg"
    >
      {loading ? (
        <>
          <LoadingSpinner className="mr-2" />
          Processing...
        </>
      ) : (
        'Platz jetzt sichern ->'
      )}
    </Button>
  )
}