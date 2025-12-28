'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface CheckoutButtonProps {
  disabled?: boolean
}

export function CheckoutButton({ disabled = false }: CheckoutButtonProps) {
  const [isLoading, setIsLoading] = useState(false)

  const handleCheckout = async () => {
    if (isLoading || disabled) return

    setIsLoading(true)

    try {
      const response = await fetch('/api/create-checkout', {
        method: 'POST',
      })

      if (!response.ok) {
        throw new Error('Checkout fehlgeschlagen')
      }

      const { url } = await response.json()

      if (url) {
        window.location.href = url
      }
    } catch (error) {
      console.error('Error starting checkout:', error)
      setIsLoading(false)
      alert('Fehler beim Starten des Checkouts. Bitte versuche es später erneut.')
    }
  }

  return (
    <Button
      onClick={handleCheckout}
      disabled={isLoading || disabled}
      className="w-full text-lg py-6"
      size="lg"
    >
      {isLoading ? (
        <>
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Wird weitergeleitet...
        </>
      ) : (
        'Jetzt Platz sichern'
      )}
    </Button>
  )
}