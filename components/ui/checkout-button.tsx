'use client'

import { useEffect, useRef, useState } from 'react'
import { SpinnerGap as Loader2 } from '@phosphor-icons/react/SpinnerGap'
import { Button } from '@/components/ui/button'
import { trackConversion } from '@/components/analytics/tracking'

const SUBSCRIPTION_EXISTS_MESSAGE =
  'Für dein Konto läuft bereits ein Mentorship-Abo. Lade die Seite neu, um deinen aktuellen Stand zu sehen.'

/** 409 von /api/create-checkout: Es läuft schon ein Abo (Doppelkauf-Schutz). */
class CheckoutConflictError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CheckoutConflictError'
  }
}

interface CheckoutButtonProps {
  disabled?: boolean
  disabledReason?: string
  label?: string
}

export function CheckoutButton({
  disabled = false,
  disabledReason,
  label = 'Weiter zur sicheren Zahlung',
}: CheckoutButtonProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const checkoutAbortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    return () => {
      checkoutAbortRef.current?.abort()
      checkoutAbortRef.current = null
    }
  }, [])

  const handleCheckout = async () => {
    if (isLoading || disabled) return

    checkoutAbortRef.current?.abort()
    const controller = new AbortController()
    checkoutAbortRef.current = controller

    setErrorMessage(null)
    setIsLoading(true)
    
    // Track Checkout-Start für Google Ads Conversion
    trackConversion.checkoutStart()

    let didRedirect = false
    let didTimeout = false
    const timeoutId = window.setTimeout(() => {
      didTimeout = true
      controller.abort()
    }, 15000)

    try {
      const response = await fetch('/api/create-checkout', {
        method: 'POST',
        signal: controller.signal,
      })

      if (response.status === 409) {
        const data: unknown = await response.json().catch(() => null)
        const message =
          data && typeof data === 'object' && typeof (data as { message?: unknown }).message === 'string'
            ? (data as { message: string }).message
            : SUBSCRIPTION_EXISTS_MESSAGE
        throw new CheckoutConflictError(message)
      }

      if (!response.ok) {
        throw new Error('Checkout fehlgeschlagen')
      }

      const { url } = await response.json()
      if (controller.signal.aborted) return

      if (!url) {
        throw new Error('Checkout-URL fehlt')
      }

      didRedirect = true
      window.location.assign(url)
    } catch (error) {
      if (controller.signal.aborted && !didTimeout) return
      console.error('Error starting checkout:', error)
      setErrorMessage(
        error instanceof CheckoutConflictError
          ? error.message
          : didTimeout
            ? 'Der Checkout antwortet gerade nicht. Bitte prüfe deine Verbindung und versuche es erneut.'
            : 'Der Checkout konnte nicht geöffnet werden. Bitte versuche es erneut oder lade die Seite neu.'
      )
    } finally {
      window.clearTimeout(timeoutId)
      if (checkoutAbortRef.current === controller) {
        checkoutAbortRef.current = null
        if (!didRedirect) {
          setIsLoading(false)
        }
      }
    }
  }

  const feedbackMessage = errorMessage ?? (!isLoading && disabled ? disabledReason : null)

  return (
    <div className="space-y-2">
      <Button
        type="button"
        onClick={handleCheckout}
        disabled={isLoading || disabled}
        aria-busy={isLoading}
        aria-describedby={feedbackMessage ? 'checkout-button-feedback' : undefined}
        className="w-full touch-manipulation py-6 text-base sm:text-lg"
        size="lg"
      >
        {isLoading ? (
          <>
            <Loader2 aria-hidden="true" className="mr-2 h-5 w-5 animate-spin motion-reduce:animate-none" />
            Stripe wird geöffnet…
          </>
        ) : (
          label
        )}
      </Button>
      {feedbackMessage ? (
        <p
          id="checkout-button-feedback"
          role={errorMessage ? 'alert' : 'status'}
          aria-live={errorMessage ? 'assertive' : 'polite'}
          className={errorMessage ? 'text-sm text-red-700' : 'text-sm text-gray-600'}
        >
          {feedbackMessage}
        </p>
      ) : null}
    </div>
  )
}
