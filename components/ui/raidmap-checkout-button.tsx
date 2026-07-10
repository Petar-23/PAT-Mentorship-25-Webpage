'use client'

import { useEffect, useRef, useState } from 'react'
import { SpinnerGap } from '@phosphor-icons/react/SpinnerGap'
import { Button } from '@/components/ui/button'
import type { RaidMapLang, RaidMapTier } from '@/lib/raidmap-config'

interface RaidMapCheckoutButtonProps {
  tier: RaidMapTier
  lang: RaidMapLang
  label: string
  loadingLabel: string
  errorMessage: string
  variant?: 'default' | 'outline'
}

export function RaidMapCheckoutButton({
  tier,
  lang,
  label,
  loadingLabel,
  errorMessage,
  variant = 'default',
}: RaidMapCheckoutButtonProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    return () => {
      abortRef.current?.abort()
    }
  }, [])

  const handleCheckout = async () => {
    if (isLoading) return

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/raidmap-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier, lang }),
        signal: controller.signal,
      })

      // Nicht eingeloggt -> zum Sign-in mit Rücksprung auf die Seite
      if (response.status === 401) {
        window.location.href = `/sign-in?redirect_url=${encodeURIComponent(window.location.pathname + '#pricing')}`
        return
      }

      if (!response.ok) {
        throw new Error('Checkout failed')
      }

      const { url } = await response.json()
      if (controller.signal.aborted) return
      if (!url) {
        throw new Error('Missing checkout URL')
      }

      window.location.href = url
    } catch (err) {
      if (controller.signal.aborted) return
      console.error('Error starting raidmap checkout:', err)
      setIsLoading(false)
      setError(errorMessage)
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null
      }
    }
  }

  return (
    <div className="w-full">
      <Button
        onClick={handleCheckout}
        disabled={isLoading}
        variant={variant}
        className="w-full text-lg py-6"
        size="lg"
      >
        {isLoading ? (
          <>
            <SpinnerGap className="mr-2 size-5 animate-spin" />
            {loadingLabel}
          </>
        ) : (
          label
        )}
      </Button>
      {error ? (
        <p role="alert" className="mt-2 text-sm text-red-600 text-pretty">
          {error}
        </p>
      ) : null}
    </div>
  )
}
