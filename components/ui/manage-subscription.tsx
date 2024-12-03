// src/components/manage-subscription.tsx
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { useToast } from "@/hooks/use-toast"
import { CreditCard } from 'lucide-react'
import { useAuth } from '@clerk/nextjs'

export function ManageSubscriptionButton() {
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()
  const { isLoaded } = useAuth()

  const handlePortalAccess = async () => {
    try {
      setLoading(true)
      
      const makeRequest = async () => {
        const response = await fetch('/api/create-portal-session', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        })
        
        const data = await response.json()
        if (!response.ok) {
          throw new Error(data.message || 'Ein Fehler ist aufgetreten')
        }
        
        return data
      }

      try {
        const data = await makeRequest()
        window.location.href = data.url
        return
      } catch (error) {
        if (error instanceof Error && error.message.includes('Nicht autorisiert')) {
          await new Promise(resolve => setTimeout(resolve, 1000))
          const data = await makeRequest()
          window.location.href = data.url
          return
        }
        throw error
      }

    } catch (error) {
      console.error('Portal access error:', error)
      toast({
        title: "Fehler",
        description: error instanceof Error ? error.message : 'Zugriff auf Abonnementverwaltung fehlgeschlagen',
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      onClick={handlePortalAccess}
      disabled={loading || !isLoaded}
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