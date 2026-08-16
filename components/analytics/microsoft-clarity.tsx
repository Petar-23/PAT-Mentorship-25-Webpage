'use client'

import { sanitizePublicEnv } from '@/lib/public-env'
import { syncClarityConsent, type ClarityConsentApi } from '@/lib/clarity-consent'
import Script from 'next/script'
import { useCallback, useEffect } from 'react'
import { useCookieConsent } from '@/hooks/use-cookie-consent'

export function MicrosoftClarity() {
  const { consent } = useCookieConsent()
  const clarityId = sanitizePublicEnv(process.env.NEXT_PUBLIC_CLARITY_ID)

  const syncConsent = useCallback(() => {
    if (typeof window === 'undefined') return
    const clarity = (window as Window & { clarity?: ClarityConsentApi }).clarity
    syncClarityConsent(clarity, consent.analytics)
  }, [consent.analytics])

  useEffect(() => {
    if (clarityId) syncConsent()
  }, [clarityId, syncConsent])

  if (!clarityId || !consent.analytics) {
    return null
  }

  return (
    <Script
      id="microsoft-clarity"
      strategy="afterInteractive"
      onReady={syncConsent}
      dangerouslySetInnerHTML={{
        __html: `
          (function(c,l,a,r,i,t,y){
            c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
            t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
            y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
          })(window, document, "clarity", "script", "${clarityId}");
        `,
      }}
    />
  )
}
