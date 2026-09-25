import {
  GOOGLE_CONSENT_DEFAULTS,
  categoryForGoogleTag,
  googleConsentState,
  googleTagDestinations,
  type CookieConsent,
} from '@/lib/cookie-consent'
import { getGoogleTagIds, markTrackingActive, readCookieConsent } from '@/lib/cookie-consent-client'

/**
 * Google-Tag (GA4 und Google Ads) mit Consent Mode v2 in der Variante "basic":
 * gtag.js wird erst nach Einwilligung geladen (siehe google-tag-manager.tsx), und nur die Ziele,
 * für die eingewilligt wurde, werden konfiguriert. Ohne Einwilligung gibt es weder window.gtag noch Anfragen an Google.
 */

const configuredDestinations = new Set<string>()
let isInitialized = false

function ensureGtag(): (...args: unknown[]) => void {
  window.dataLayer = window.dataLayer || []
  if (typeof window.gtag === 'function') return window.gtag

  const gtag = function gtag() {
    // gtag.js erwartet das arguments-Objekt, kein Array. Deshalb keine Rest-Parameter.
    window.dataLayer?.push(arguments)
  }
  window.gtag = gtag
  return gtag
}

/**
 * Bringt den Google-Tag auf den Stand der Einwilligung.
 * Reihenfolge: consent default (alles denied), js, consent update, config je eingewilligtem Ziel.
 * Liefert die Ziele, an die gesendet werden darf. Leer heißt: nichts vorbereitet, nichts senden.
 */
export function prepareGoogleTag(consent: CookieConsent | null | undefined): string[] {
  if (typeof window === 'undefined' || !consent) return []
  const ids = getGoogleTagIds()
  const destinations = googleTagDestinations(consent, ids)
  if (destinations.length === 0) return []

  const gtag = ensureGtag()
  if (!isInitialized) {
    gtag('consent', 'default', { ...GOOGLE_CONSENT_DEFAULTS })
    gtag('js', new Date())
    isInitialized = true
  }

  gtag('set', 'ads_data_redaction', !consent.marketing)
  gtag('consent', 'update', googleConsentState(consent))

  const flags = window as unknown as Record<string, unknown>
  for (const id of destinations) {
    flags[`ga-disable-${id}`] = false
    if (!configuredDestinations.has(id)) {
      gtag('config', id)
      configuredDestinations.add(id)
    }
    const category = categoryForGoogleTag(id, ids)
    if (category) markTrackingActive(category)
  }

  return destinations
}

/** Ziele für ein Event bei der aktuell gespeicherten Einwilligung. Bereitet den Tag bei Bedarf vor. */
function allowedDestinations(): string[] {
  const consent = readCookieConsent()
  const destinations = googleTagDestinations(consent, getGoogleTagIds())
  if (destinations.length === 0) return []
  // Neu eingewilligte Ziele (etwa aus einem anderen Tab) erst konfigurieren, bevor ein Event an sie geht.
  if (!isInitialized || destinations.some(id => !configuredDestinations.has(id))) return prepareGoogleTag(consent)
  return destinations
}

/**
 * Sendet ein Event nur an Ziele mit Einwilligung. Vor der Einwilligung: No-op.
 * Events nach der Einwilligung, aber vor dem Laden von gtag.js, warten in window.dataLayer.
 */
export function sendGoogleEvent(eventName: string, eventParams?: Record<string, unknown>): boolean {
  if (typeof window === 'undefined') return false
  const destinations = allowedDestinations()
  if (destinations.length === 0 || typeof window.gtag !== 'function') return false
  window.gtag('event', eventName, { ...eventParams, send_to: destinations })
  return true
}

/** Google-Ads-Conversion. Nur mit Marketing-Einwilligung. */
export function sendGoogleAdsConversion(conversionLabel: string | undefined, eventParams?: Record<string, unknown>): boolean {
  if (typeof window === 'undefined' || !conversionLabel) return false
  const { adsId } = getGoogleTagIds()
  if (!adsId || !allowedDestinations().includes(adsId) || typeof window.gtag !== 'function') return false
  window.gtag('event', 'conversion', { ...eventParams, send_to: `${adsId}/${conversionLabel}` })
  return true
}

declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: (...args: unknown[]) => void
  }
}
