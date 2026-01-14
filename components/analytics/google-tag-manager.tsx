'use client'

import { useEffect, useState } from 'react'
import Script from 'next/script'

interface CookieConsent {
  necessary: boolean
  analytics: boolean
  marketing: boolean
}

/**
 * Google Ads Tag (gtag.js) Komponente
 * Lädt das Google Ads Script nur, wenn der Nutzer Marketing-Cookies akzeptiert hat.
 * 
 * Wichtig: Du musst NEXT_PUBLIC_GOOGLE_ADS_ID als Environment Variable setzen:
 * NEXT_PUBLIC_GOOGLE_ADS_ID=AW-XXXXXXXXXX
 */
export function GoogleTagManager() {
  const [hasConsent, setHasConsent] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)
  const googleAdsId = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID

  useEffect(() => {
    // Prüfe initialen Consent
    const checkConsent = () => {
      const storedConsent = localStorage.getItem('cookieConsent')
      if (storedConsent) {
        const consent = JSON.parse(storedConsent) as CookieConsent
        setHasConsent(consent.marketing === true)
      }
    }

    checkConsent()

    // Lausche auf Änderungen im localStorage (z.B. wenn User Consent ändert)
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

  // Wenn keine Google Ads ID konfiguriert ist, nichts rendern
  if (!googleAdsId) {
    return null
  }

  // Wenn kein Marketing-Consent, nichts laden
  if (!hasConsent) {
    return null
  }

  return (
    <>
      {/* Google Ads Tag (gtag.js) */}
      <Script
        id="google-ads-script"
        src={`https://www.googletagmanager.com/gtag/js?id=${googleAdsId}`}
        strategy="afterInteractive"
        onLoad={() => setIsLoaded(true)}
      />
      <Script
        id="google-ads-config"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${googleAdsId}');
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
 * 
 * Wichtig: Für vollständiges Conversion-Tracking brauchst du das Conversion-Label
 * aus Google Ads. Setze es als NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_LABEL.
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
