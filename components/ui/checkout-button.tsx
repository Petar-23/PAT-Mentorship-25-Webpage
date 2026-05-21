'use client'

import { useEffect, useRef, useState } from 'react'
import { SpinnerGap as Loader2 } from '@phosphor-icons/react/SpinnerGap'
import { Button } from '@/components/ui/button'
import { trackConversion } from '@/components/analytics/tracking'

interface CheckoutButtonProps {
  disabled?: boolean
}

export function CheckoutButton({ disabled = false }: CheckoutButtonProps) {
  const [isLoading, setIsLoading] = useState(false)
  const checkoutAbortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    return () => {
      checkoutAbortRef.current?.abort()
    }
  }, [])

  const handleCheckout = async () => {
    if (isLoading || disabled) return

    checkoutAbortRef.current?.abort()
    const controller = new AbortController()
    checkoutAbortRef.current = controller

    setIsLoading(true)
    
    // Track Checkout-Start für Google Ads Conversion
    trackConversion.checkoutStart()

    try {
      const response = await fetch('/api/create-checkout', {
        method: 'POST',
        signal: controller.signal,
      })

      if (!response.ok) {
        throw new Error('Checkout fehlgeschlagen')
      }

      const { url } = await response.json()
      if (controller.signal.aborted) return

      if (!url) {
        throw new Error('Checkout-URL fehlt')
      }

      window.location.href = url
    } catch (error) {
      if (controller.signal.aborted) return
      console.error('Error starting checkout:', error)
      setIsLoading(false)
      alert('Fehler beim Starten des Checkouts. Bitte versuche es später erneut.')
    } finally {
      if (checkoutAbortRef.current === controller) {
        checkoutAbortRef.current = null
      }
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
