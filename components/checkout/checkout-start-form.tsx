'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { LockIcon } from '@phosphor-icons/react/Lock'
import { SpinnerGap } from '@phosphor-icons/react/SpinnerGap'
import { trackConversion } from '@/components/analytics/tracking'
import { Button } from '@/components/ui/button'

// Formular auf /checkout: klassischer POST an /api/checkout/start (funktioniert auch ohne JavaScript),
// der Server leitet mit 303 zu Stripe weiter. JavaScript ergänzt nur Tracking und Ladezustand.
// ANWALTLICH PRÜFEN: Checkbox-Text (kommt aus lib/legal-texts.ts) und dass sie Pflicht ist.

const LINK_CLASS = 'text-blue-700 underline underline-offset-2 hover:text-blue-900'

export function CheckoutStartForm({
  src,
  consentText,
  consentError,
}: {
  src: string
  consentText: string
  consentError: string | null
}) {
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    // Zurück aus Stripe über den Browser-Verlauf (bfcache): Button wieder freigeben.
    const reset = (event: PageTransitionEvent) => {
      if (event.persisted) setSubmitting(false)
    }
    window.addEventListener('pageshow', reset)
    return () => window.removeEventListener('pageshow', reset)
  }, [])

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    if (submitting) {
      event.preventDefault()
      return
    }
    trackConversion.checkoutStart()
    setSubmitting(true)
  }

  return (
    <form action="/api/checkout/start" method="post" onSubmit={onSubmit} className="space-y-5">
      <input type="hidden" name="src" value={src} />

      <div
        className={
          consentError
            ? 'flex items-start gap-3 rounded-lg border border-red-300 bg-red-50 p-4'
            : 'flex items-start gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4'
        }
      >
        <input
          type="checkbox"
          id="consent_early_start"
          name="consent_early_start"
          value="1"
          required
          aria-invalid={consentError ? true : undefined}
          aria-describedby={consentError ? 'consent_early_start-error' : undefined}
          className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer rounded border-gray-300 accent-blue-700 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
        />
        <label htmlFor="consent_early_start" className="cursor-pointer text-sm leading-relaxed text-gray-700">
          {consentText}
        </label>
      </div>
      {consentError ? (
        <p id="consent_early_start-error" role="alert" className="-mt-2 text-sm text-red-700">
          {consentError}
        </p>
      ) : null}

      <p className="text-sm leading-relaxed text-gray-600">
        Es gelten unsere{' '}
        <a href="/AGB" target="_blank" rel="noopener noreferrer" className={LINK_CLASS}>
          AGB
        </a>
        . Hier findest du die{' '}
        <a href="/Widerruf" target="_blank" rel="noopener noreferrer" className={LINK_CLASS}>
          Widerrufsbelehrung
        </a>{' '}
        und die{' '}
        <a href="/datenschutz" target="_blank" rel="noopener noreferrer" className={LINK_CLASS}>
          Datenschutzerklärung
        </a>
        .
      </p>

      <Button
        type="submit"
        size="lg"
        className="w-full touch-manipulation py-6 text-base sm:text-lg"
        disabled={submitting}
        aria-busy={submitting}
      >
        {submitting ? (
          <>
            <SpinnerGap aria-hidden="true" className="h-5 w-5 animate-spin motion-reduce:animate-none" />
            Weiterleitung zu Stripe …
          </>
        ) : (
          'Weiter zur Zahlung'
        )}
      </Button>

      <p className="flex items-start justify-center gap-2 text-center text-sm text-gray-500">
        <LockIcon aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
        <span>Du wirst zu Stripe weitergeleitet. Kostenpflichtig bestellst du erst dort.</span>
      </p>
    </form>
  )
}
