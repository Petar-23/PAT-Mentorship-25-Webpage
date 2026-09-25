'use client'

import Link from 'next/link'
import { useEffect, useId, useRef, useState, type ComponentPropsWithoutRef, type FormEvent } from 'react'
import { Info as PhosphorInfo } from '@phosphor-icons/react/dist/ssr/Info'
import { ArrowRight, WarningCircle } from '@/components/mentorship/icons'
import { useResearchHref } from '@/components/research/base-path'
import { RESEARCH_CONSENT_TEXT, RESEARCH_TIERS, RESEARCH_TIER_DETAILS, type ResearchInterval, type ResearchTier } from '@/lib/research/config.mjs'
import {
  isSafeBillingRedirect,
  researchCheckoutError,
  researchIntervalLabel,
  researchPlanPrice,
  researchSignInHref,
  splitTermsLink,
} from '@/lib/research/ui.mjs'

// API routes are NOT base-prefixed: they live at /api/research/* on every host.
const CHECKOUT_ENDPOINT = '/api/research/checkout'

type Props = {
  signedIn: boolean
  initialTier: ResearchTier
  initialInterval: ResearchInterval
  checkoutCancelled: boolean
}

type CheckoutError = ReturnType<typeof researchCheckoutError>

function Info(props: ComponentPropsWithoutRef<'svg'>) {
  return <PhosphorInfo size={24} weight="bold" focusable="false" aria-hidden="true" {...props} />
}

function TermsConsentText({ termsHref }: { termsHref: string }) {
  const parts = splitTermsLink(RESEARCH_CONSENT_TEXT.terms)
  const link = (text: string) => <a href={termsHref} target="_blank" rel="noopener">{text}<span className="sr-only"> (opens in a new tab)</span></a>
  if (!parts) return <>{RESEARCH_CONSENT_TEXT.terms} {link('Read the terms')}</>
  return <>{parts.before}{link(parts.link)}{parts.after}</>
}

export function ResearchPricingClient({ signedIn, initialTier, initialInterval, checkoutCancelled }: Props) {
  const href = useResearchHref()
  const [interval, setBillingInterval] = useState<ResearchInterval>(initialInterval)
  const [tier, setTier] = useState<ResearchTier>(initialTier)
  const [acceptTerms, setAcceptTerms] = useState(false)
  const [waiveWithdrawal, setWaiveWithdrawal] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<CheckoutError | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const ids = useId()
  const consentHintId = `${ids}-consent-hint`

  useEffect(() => {
    // Back from Stripe via the browser's back/forward cache: allow a new attempt.
    const reset = (event: PageTransitionEvent) => { if (event.persisted) setSubmitting(false) }
    window.addEventListener('pageshow', reset)
    return () => {
      window.removeEventListener('pageshow', reset)
      abortRef.current?.abort()
    }
  }, [])

  const selected = RESEARCH_TIER_DETAILS[tier]
  const selectedPrice = researchPlanPrice(tier, interval)
  const consentsGiven = acceptTerms && waiveWithdrawal
  const signInHref = researchSignInHref(href, `/pricing?tier=${tier}&interval=${interval}`)

  async function startCheckout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!consentsGiven || submitting) return

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setSubmitting(true)
    setError(null)

    try {
      const response = await fetch(CHECKOUT_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier, interval, acceptTerms: true, waiveWithdrawal: true }),
        signal: controller.signal,
      })
      const data = await response.json().catch(() => null) as { url?: unknown; code?: unknown; message?: unknown } | null
      if (controller.signal.aborted) return

      if (response.ok && isSafeBillingRedirect(data?.url)) {
        window.location.assign(data.url)
        return
      }
      setError(response.ok ? researchCheckoutError(null) : researchCheckoutError(data?.code, data?.message))
      setSubmitting(false)
    } catch {
      if (controller.signal.aborted) return
      setError(researchCheckoutError(null))
      setSubmitting(false)
    } finally {
      if (abortRef.current === controller) abortRef.current = null
    }
  }

  return (
    <div className="r-pricing">
      {checkoutCancelled ? (
        <p className="r-notice" role="status"><Info aria-hidden="true" /><span>Checkout was cancelled. You have not been charged.</span></p>
      ) : null}

      <fieldset className="r-interval" data-interval={interval}>
        <legend className="sr-only">Billing interval</legend>
        {(['month', 'year'] as const).map(value => (
          <label key={value}>
            <input type="radio" name="research-interval" value={value} className="sr-only"
              checked={interval === value} onChange={() => setBillingInterval(value)} />
            <span>{researchIntervalLabel(value)}</span>
            {value === 'year' ? <small>2 months free</small> : null}
          </label>
        ))}
      </fieldset>

      <p className="r-same-access">Every tier unlocks exactly the same research — pay what you can.</p>

      <fieldset className="r-tier-grid">
        <legend className="sr-only">Choose your price</legend>
        {RESEARCH_TIERS.map(value => {
          const details = RESEARCH_TIER_DETAILS[value]
          const price = researchPlanPrice(value, interval)
          const noteId = `${ids}-${value}-note`
          return (
            <label key={value} className="r-tier" data-recommended={details.recommended || undefined}>
              <input type="radio" name="research-tier" value={value} className="sr-only"
                checked={tier === value} onChange={() => setTier(value)}
                aria-describedby={details.supporterCredit ? noteId : undefined} />
              <span className="r-tier-head">
                <span className="r-radio" aria-hidden="true" />
                <span className="r-tier-name">{details.label}</span>
                {details.recommended ? <span className="r-badge">Recommended</span> : null}
              </span>
              <span className="r-price">
                <span className="r-price-amount">{price.amount}</span>
                <span className="r-price-period">{price.period}</span>
              </span>
              <span className="r-price-saving" data-highlight={price.saving ? true : undefined}>{price.saving ?? 'Billed monthly'}</span>
              {details.supporterCredit ? (
                <span className="r-tier-note" id={noteId}>Optional: be credited as a supporter in videos (opt-in, off by default)</span>
              ) : null}
            </label>
          )
        })}
      </fieldset>

      {signedIn ? (
        <form className="r-checkout" onSubmit={startCheckout} aria-labelledby={`${ids}-summary`}>
          <p className="r-summary" id={`${ids}-summary`}>
            <span>{selected.label} · {researchIntervalLabel(interval)}</span>
            <span>{selectedPrice.summary}</span>
          </p>
          <label className="r-consent">
            <input type="checkbox" checked={acceptTerms} onChange={event => setAcceptTerms(event.target.checked)} />
            <span><TermsConsentText termsHref={href('/terms')} /></span>
          </label>
          <label className="r-consent">
            <input type="checkbox" checked={waiveWithdrawal} onChange={event => setWaiveWithdrawal(event.target.checked)} />
            <span>{RESEARCH_CONSENT_TEXT.withdrawalWaiver}</span>
          </label>
          <div className="r-submit-row">
            <button type="submit" className="r-button" disabled={!consentsGiven || submitting}
              aria-describedby={consentsGiven ? undefined : consentHintId} aria-busy={submitting || undefined}>
              {submitting ? <span className="r-spinner" aria-hidden="true" /> : null}
              <span>{submitting ? 'Opening checkout…' : 'Continue to checkout'}</span>
              {submitting ? null : <ArrowRight aria-hidden="true" />}
            </button>
            {consentsGiven ? null : <p className="r-hint" id={consentHintId}>Confirm both statements to continue.</p>}
          </div>
          <div className="r-checkout-feedback" role="alert">
            {error ? (
              <p className="r-notice" data-tone="error">
                <WarningCircle aria-hidden="true" />
                <span>
                  {error.message}
                  {error.action === 'account' ? <> <Link href={href('/account')} prefetch={false}>Go to your account</Link></> : null}
                  {error.action === 'sign-in' ? <> <Link href={signInHref} prefetch={false}>Sign in</Link></> : null}
                </span>
              </p>
            ) : null}
          </div>
        </form>
      ) : (
        <div className="r-checkout">
          <p className="r-summary">
            <span>{selected.label} · {researchIntervalLabel(interval)}</span>
            <span>{selectedPrice.summary}</span>
          </p>
          <div className="r-submit-row">
            <Link href={signInHref} prefetch={false} className="r-button">
              <span>Sign in to subscribe</span>
              <ArrowRight aria-hidden="true" />
            </Link>
            <p className="r-hint">You&apos;ll confirm the terms after signing in. New here? You can create an account on the next screen.</p>
          </div>
        </div>
      )}

      <p className="r-small-print">
        Prices in USD, including applicable VAT/sales tax. Payments are processed by Stripe.
        You can cancel anytime from your account; access continues until the end of the period you paid for.
      </p>
    </div>
  )
}
