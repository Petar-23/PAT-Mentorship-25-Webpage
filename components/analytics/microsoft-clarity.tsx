'use client'

import { useEffect } from 'react'
import Script from 'next/script'
import { clarityConsentState } from '@/lib/cookie-consent'
import { markTrackingActive, useCookieConsent } from '@/lib/cookie-consent-client'
import { sanitizePublicEnv } from '@/lib/public-env'

/**
 * Microsoft Clarity lädt nur mit Einwilligung in "Analyse".
 * Direkt nach dem Stub geht die Einwilligung per consentv2 an Clarity (ad_Storage bleibt denied).
 * Widerruf: lib/cookie-consent-client.ts ruft consentv2 mit denied und consent(false) auf, danach lädt das Banner die Seite neu.
 */
export function MicrosoftClarity() {
  const consent = useCookieConsent()
  const clarityId = sanitizePublicEnv(process.env.NEXT_PUBLIC_CLARITY_ID)
  const isAnalyticsGranted = consent?.analytics === true

  useEffect(() => {
    if (clarityId && isAnalyticsGranted) markTrackingActive('analytics')
  }, [clarityId, isAnalyticsGranted])

  if (!clarityId || !isAnalyticsGranted) {
    return null
  }

  const consentState = JSON.stringify(clarityConsentState(consent))

  return (
    <Script
      id="microsoft-clarity"
      strategy="afterInteractive"
      dangerouslySetInnerHTML={{
        __html: `
          (function(c,l,a,r,i,t,y){
            c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
            t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
            y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
          })(window, document, "clarity", "script", ${JSON.stringify(clarityId)});
          window.clarity("consentv2", ${consentState});
        `,
      }}
    />
  )
}
