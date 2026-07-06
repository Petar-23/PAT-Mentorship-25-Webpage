'use client'

import type { FormEvent } from 'react'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

export function PayPalClaimForm() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const redirectTimeoutRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      abortRef.current?.abort()
      if (redirectTimeoutRef.current != null) {
        window.clearTimeout(redirectTimeoutRef.current)
      }
    }
  }, [])

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    try {
      const res = await fetch('/api/claim/paypal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paypalEmail: email }),
        signal: controller.signal,
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Ein Fehler ist aufgetreten.')
        return
      }

      setSuccess(true)
      redirectTimeoutRef.current = window.setTimeout(() => {
        router.push(data.redirectUrl || '/mentorship')
        redirectTimeoutRef.current = null
      }, 2000)
    } catch (error) {
      if (controller.signal.aborted) return
      setError('Netzwerkfehler. Bitte versuche es erneut.')
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false)
      }
    }
  }

  if (success) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <div className="mb-4 text-4xl">&#10003;</div>
            <p className="text-lg font-medium text-neutral-900">
              Dein PayPal-Abo wurde erfolgreich verknuepft!
            </p>
            <p className="mt-2 text-sm text-neutral-500">
              Du wirst zum Mentorship-Bereich weitergeleitet...
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-xl">PayPal-Abo verknuepfen</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-6 text-sm text-neutral-500">
            Gib die Email-Adresse ein, mit der du bei PayPal bezahlst. Dein Abo
            wird automatisch geprueft und dein Zugang freigeschaltet.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label
                htmlFor="paypal-email"
                className="text-sm font-medium text-neutral-900"
              >
                PayPal Email-Adresse
              </label>
              <Input
                id="paypal-email"
                type="email"
                placeholder="deine@paypal-email.de"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            {error && (
              <p className="text-pretty text-sm text-red-600" role="alert">
                {error}
              </p>
            )}

            <Button
              type="submit"
              size="lg"
              className="w-full"
              disabled={loading || !email}
            >
              {loading ? 'Wird geprueft...' : 'Zugang freischalten'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
