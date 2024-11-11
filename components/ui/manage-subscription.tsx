// src/components/manage-subscription.tsx
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { useToast } from "@/hooks/use-toast"
import { CreditCard } from 'lucide-react'

export function ManageSubscriptionButton() {
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  const handlePortalAccess = async () => {
    try {
      setLoading(true)
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

      // Redirect to Stripe Customer Portal
      window.location.href = data.url
    } catch (error) {
      console.error('Portal access error:', error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to access subscription management',
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      onClick={handlePortalAccess}
      disabled={loading}
      variant="outline"
      className="w-full"
    >
      {loading ? (
        <>
          <LoadingSpinner className="mr-2 h-4 w-4" />
          Läd...
        </>
      ) : (
        <>
          <CreditCard className="mr-2 h-4 w-4" />
          Abonnement Verwalten
        </>
      )}
    </Button>
  )
}