// src/components/manage-subscription.tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { Button, type ButtonProps } from '@/components/ui/button'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { useToast } from "@/hooks/use-toast"
import { CreditCard } from '@phosphor-icons/react/CreditCard'
import { useAuth } from '@clerk/nextjs'
import { cn } from '@/lib/utils'

type Props = {
  variant?: ButtonProps['variant']
  size?: ButtonProps['size']
  className?: string
  label?: string
  iconClassName?: string
  iconWrapperClassName?: string
  spinnerClassName?: string
  /** Portal-API-Route; Raid Map nutzt einen eigenen Stripe-Customer (eigene Route). */
  endpoint?: string
}

export function ManageSubscriptionButton({
  variant = 'outline',
  size = 'default',
  className,
  label = 'Abonnement Verwalten',
  iconClassName,
  iconWrapperClassName,
  spinnerClassName,
  endpoint = '/api/create-portal-session',
}: Props) {
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()
  const { isLoaded } = useAuth()
  const portalAbortRef = useRef<AbortController | null>(null)
  const retryTimeoutRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      portalAbortRef.current?.abort()
      if (retryTimeoutRef.current !== null) {
        window.clearTimeout(retryTimeoutRef.current)
      }
    }
  }, [])

  const waitForRetry = (signal: AbortSignal) =>
    new Promise<void>((resolve, reject) => {
      if (signal.aborted) {
        reject(new DOMException('Aborted', 'AbortError'))
        return
      }

      const handleAbort = () => {
        if (retryTimeoutRef.current !== null) {
          window.clearTimeout(retryTimeoutRef.current)
          retryTimeoutRef.current = null
        }
        reject(new DOMException('Aborted', 'AbortError'))
      }

      retryTimeoutRef.current = window.setTimeout(() => {
        retryTimeoutRef.current = null
        signal.removeEventListener('abort', handleAbort)
        resolve()
      }, 1000)

      signal.addEventListener('abort', handleAbort, { once: true })
    })

  const handlePortalAccess = async () => {
    if (loading || !isLoaded) return

    portalAbortRef.current?.abort()
    const controller = new AbortController()
    portalAbortRef.current = controller

    try {
      setLoading(true)
      
      const makeRequest = async () => {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          signal: controller.signal,
        })
        
        const data = await response.json()
        if (controller.signal.aborted) {
          throw new DOMException('Aborted', 'AbortError')
        }

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
          await waitForRetry(controller.signal)
          const data = await makeRequest()
          window.location.href = data.url
          return
        }
        throw error
      }

    } catch (error) {
      if (controller.signal.aborted) return
      console.error('Portal access error:', error)
      toast({
        title: "Fehler",
        description: error instanceof Error ? error.message : 'Zugriff auf Abonnementverwaltung fehlgeschlagen',
        variant: "destructive",
      })
    } finally {
      if (portalAbortRef.current === controller) {
        portalAbortRef.current = null
      }
      if (!controller.signal.aborted) {
        setLoading(false)
      }
    }
  }

  return (
    <Button
      onClick={handlePortalAccess}
      disabled={loading || !isLoaded}
      variant={variant}
      size={size}
      className={cn('w-full', className)}
    >
      {loading ? (
        <>
          <span className={cn('flex items-center justify-center shrink-0', iconWrapperClassName)}>
            <LoadingSpinner className={cn('h-4 w-4', spinnerClassName)} />
          </span>
          <span>Läd...</span>
        </>
      ) : (
        <>
          <span className={cn('flex items-center justify-center shrink-0', iconWrapperClassName)}>
            <CreditCard className={cn('h-4 w-4', iconClassName)} />
          </span>
          <span>{label}</span>
        </>
      )}
    </Button>
  )
}
