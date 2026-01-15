'use client'

import { useEffect, useState, useRef } from 'react'
import Script from 'next/script'

interface CookieConsent {
  necessary: boolean
  analytics: boolean
  marketing: boolean
}

/**
 * Google Ads Tag (gtag.js) mit Consent Mode v2
 * 
 * Das Tag wird IMMER geladen (damit Google es findet), aber:
 * - Ohne Cookie-Consent: Keine Daten werden gesammelt (denied)
 * - Mit Cookie-Consent: Volles Tracking aktiviert (granted)
 * 
 * Das ist die offizielle, DSGVO-konforme Google-Lösung.
 */
export function GoogleTagManager() {
  const [consentState, setConsentState] = useState<{
    analytics: 'pending' | 'granted' | 'denied'
    marketing: 'pending' | 'granted' | 'denied'
  }>({
    analytics: 'pending',
    marketing: 'pending',
  })
  const hasInitialized = useRef(false)
  const googleAdsId = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID
  const googleAnalyticsId = process.env.NEXT_PUBLIC_GA_ID

  useEffect(() => {
    // Prüfe initialen Consent
    const checkConsent = () => {
      const storedConsent = localStorage.getItem('cookieConsent')
      if (storedConsent) {
        const consent = JSON.parse(storedConsent) as CookieConsent
        setConsentState({
          analytics: consent.analytics === true ? 'granted' : 'denied',
          marketing: consent.marketing === true ? 'granted' : 'denied',
        })
      } else {
        // Noch keine Entscheidung getroffen
        setConsentState({
          analytics: 'denied',
          marketing: 'denied',
        })
      }
    }

    checkConsent()

    // Lausche auf Änderungen im localStorage
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'cookieConsent') {
        checkConsent()
      }
    }

    window.addEventListener('storage', handleStorageChange)

    // Custom Event für Same-Tab Updates
    const handleConsentChange = () => checkConsent()
    window.addEventListener('cookieConsentChanged', handleConsentChange)

    return () => {
      window.removeEventListener('storage', handleStorageChange)
      window.removeEventListener('cookieConsentChanged', handleConsentChange)
    }
  }, [])

  // Update Google Consent wenn sich der Status ändert
  useEffect(() => {
    if (
      consentState.analytics !== 'pending' &&
      consentState.marketing !== 'pending' &&
      typeof window !== 'undefined' &&
      typeof window.gtag === 'function'
    ) {
      window.gtag('consent', 'update', {
        'ad_storage': consentState.marketing,
        'ad_user_data': consentState.marketing,
        'ad_personalization': consentState.marketing,
        'analytics_storage': consentState.analytics,
      })
    }
  }, [consentState])

  const gtagId = googleAnalyticsId ?? googleAdsId

  // Wenn keine ID konfiguriert ist, nichts rendern
  if (!gtagId) {
    return null
  }

  return (
    <>
      {/* Google Consent Mode v2 - Default auf "denied" setzen BEVOR gtag.js lädt */}
      <Script
        id="google-consent-init"
        strategy="beforeInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            
            // Consent Mode v2: Default auf "denied" (DSGVO-konform)
            gtag('consent', 'default', {
              'ad_storage': 'denied',
              'ad_user_data': 'denied',
              'ad_personalization': 'denied',
              'analytics_storage': 'denied',
              'wait_for_update': 500
            });
          `,
        }}
      />

      {/* Google Tag (gtag.js) - lädt immer, respektiert aber Consent */}
      <Script
        id="google-gtag-script"
        src={`https://www.googletagmanager.com/gtag/js?id=${gtagId}`}
        strategy="afterInteractive"
      />
      <Script
        id="google-gtag-config"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            gtag('js', new Date());
            ${googleAnalyticsId ? `gtag('config', '${googleAnalyticsId}');` : ''}
            ${googleAdsId ? `gtag('config', '${googleAdsId}');` : ''}
          `,
        }}
      />
    </>
  )
}

/**
 * Hilfsfunktion um Events an gtag zu senden
 * Kann von überall in der App aufgerufen werden
 */
export function trackEvent(eventName: string, eventParams?: Record<string, unknown>) {
  if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
    window.gtag('event', eventName, eventParams)
  }
}

/**
 * Spezifische Conversion-Events für Google Ads
 */
export const trackConversion = {
  // Wenn jemand auf "Sichere dir deinen Platz" klickt
  ctaClick: () => {
    trackEvent('cta_click', {
      event_category: 'engagement',
      event_label: 'hero_cta',
    })
  },

  // Wenn jemand den Sign-In Dialog öffnet
  signInStart: () => {
    trackEvent('sign_in_start', {
      event_category: 'engagement',
      event_label: 'begin_sign_in',
    })
  },

  // Wenn jemand sich erfolgreich einloggt/registriert
  signInComplete: () => {
    trackEvent('sign_in_complete', {
      event_category: 'conversion',
      event_label: 'user_authenticated',
    })
  },

  // Wenn jemand den Checkout startet
  checkoutStart: () => {
    trackEvent('begin_checkout', {
      event_category: 'conversion',
      event_label: 'checkout_initiated',
    })
  },

  // Wenn jemand erfolgreich kauft - das ist die wichtigste Conversion!
  purchase: (value?: number) => {
    const googleAdsId = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID
    const conversionLabel = process.env.NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_LABEL

    // Standard Event-Tracking
    trackEvent('purchase', {
      event_category: 'conversion',
      event_label: 'subscription_started',
      value: value ?? 150,
      currency: 'EUR',
    })

    // Google Ads Conversion Tracking (wenn Label konfiguriert ist)
    if (googleAdsId && conversionLabel && typeof window !== 'undefined' && typeof window.gtag === 'function') {
      window.gtag('event', 'conversion', {
        send_to: `${googleAdsId}/${conversionLabel}`,
        value: value ?? 150,
        currency: 'EUR',
      })
    }
  },
}

// TypeScript Deklaration für window.gtag
declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: (...args: unknown[]) => void
  }
}
