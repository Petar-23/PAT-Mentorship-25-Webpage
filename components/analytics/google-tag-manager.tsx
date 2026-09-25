'use client'

import { useEffect } from 'react'
import Script from 'next/script'
import { prepareGoogleTag } from '@/components/analytics/google-tag'
import { googleTagScriptId } from '@/lib/cookie-consent'
import { getGoogleTagIds, useCookieConsent } from '@/lib/cookie-consent-client'

/**
 * Google-Tag (gtag.js) für GA4 und Google Ads mit Consent Mode v2, Variante "basic".
 *
 * - Ohne Einwilligung in Analyse oder Marketing wird gtag.js NICHT geladen und window.gtag existiert nicht.
 * - Nach der Einwilligung: consent default (alles denied), dann consent update mit der Auswahl,
 *   dann config nur für die eingewilligten Ziele (GA4 bei Analyse, Google Ads bei Marketing). Erst dann lädt gtag.js.
 * - Widerruf: lib/cookie-consent-client.ts setzt consent auf denied, sperrt die Ziele, löscht die Cookies,
 *   und das Banner lädt die Seite neu, damit gtag.js nicht weiterläuft.
 */
export function GoogleTagManager() {
  const consent = useCookieConsent()
  const scriptId = consent ? googleTagScriptId(consent, getGoogleTagIds()) : null

  useEffect(() => {
    if (consent) prepareGoogleTag(consent)
  }, [consent])

  if (!scriptId) {
    return null
  }

  // Die Ziel-ID in der URL bestimmt nur den ersten Container. Weitere Ziele lädt gtag.js bei config selbst nach.
  return (
    <Script
      id="google-gtag-script"
      src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(scriptId)}`}
      strategy="afterInteractive"
    />
  )
}
