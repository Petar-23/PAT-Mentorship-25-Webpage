'use client'

import { sanitizePublicEnv } from '@/lib/public-env'
import { useCallback, useEffect } from 'react'
import Script from 'next/script'
import { useCookieConsent } from '@/hooks/use-cookie-consent'

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
  const { consent } = useCookieConsent()
  const googleAdsId = sanitizePublicEnv(process.env.NEXT_PUBLIC_GOOGLE_ADS_ID)
  const googleAnalyticsId = sanitizePublicEnv(process.env.NEXT_PUBLIC_GA_ID)
  const analyticsConsent = consent.analytics ? 'granted' : 'denied'
  const marketingConsent = consent.marketing ? 'granted' : 'denied'

  const syncConsent = useCallback(() => {
    if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
      window.gtag('consent', 'update', {
        'ad_storage': marketingConsent,
        'ad_user_data': marketingConsent,
        'ad_personalization': marketingConsent,
        'analytics_storage': analyticsConsent,
      })
    }
  }, [analyticsConsent, marketingConsent])

  // Update Google Consent after hydration and whenever the stored choice changes.
  useEffect(syncConsent, [syncConsent])

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
        strategy="afterInteractive"
        onReady={syncConsent}
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
