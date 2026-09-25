'use client'

import { useEffect, useRef, useState } from 'react'
import { ArrowUpRight } from '@/components/mentorship/icons'
import { isSafeBillingRedirect, researchPortalError } from '@/lib/research/ui.mjs'

// Research uses its own Stripe customer; the portal route is NOT base-prefixed.
const PORTAL_ENDPOINT = '/api/research/portal'

export function ManageBillingButton({ label = 'Manage billing', variant = 'primary' }: {
  label?: string
  variant?: 'primary' | 'secondary'
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    // Back from Stripe via the browser's back/forward cache: make the button usable again.
    const reset = (event: PageTransitionEvent) => { if (event.persisted) setLoading(false) }
    window.addEventListener('pageshow', reset)
    return () => {
      window.removeEventListener('pageshow', reset)
      abortRef.current?.abort()
    }
  }, [])

  async function openPortal() {
    if (loading) return
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(PORTAL_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
        signal: controller.signal,
      })
      const data = await response.json().catch(() => null) as { url?: unknown; code?: unknown } | null
      if (controller.signal.aborted) return

      if (response.ok && isSafeBillingRedirect(data?.url)) {
        window.location.assign(data.url)
        return
      }
      setError(researchPortalError(response.status, data?.code))
      setLoading(false)
    } catch {
      if (controller.signal.aborted) return
      setError(researchPortalError(0, null))
      setLoading(false)
    } finally {
      if (abortRef.current === controller) abortRef.current = null
    }
  }

  return (
    <div className="r-billing-action">
      <button type="button" className="r-button" data-variant={variant} onClick={openPortal} disabled={loading} aria-busy={loading || undefined}>
        {loading ? <span className="r-spinner" aria-hidden="true" /> : null}
        <span>{loading ? 'Opening billing…' : label}</span>
        {loading ? null : <ArrowUpRight aria-hidden="true" />}
      </button>
      <p className="r-inline-error" role="alert">{error}</p>
    </div>
  )
}
