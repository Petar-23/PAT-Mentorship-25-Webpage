'use client'

import { useEffect, useState } from 'react'
import Script from 'next/script'

interface CookieConsent {
  necessary: boolean
  analytics: boolean
  marketing: boolean
}

export function MicrosoftClarity() {
  const [isAnalyticsGranted, setIsAnalyticsGranted] = useState(false)
  const clarityId = process.env.NEXT_PUBLIC_CLARITY_ID

  useEffect(() => {
    const checkConsent = () => {
      const storedConsent = localStorage.getItem('cookieConsent')
      if (!storedConsent) {
        setIsAnalyticsGranted(false)
        return
      }
      try {
        const consent = JSON.parse(storedConsent) as CookieConsent
        setIsAnalyticsGranted(consent.analytics === true)
      } catch {
        setIsAnalyticsGranted(false)
      }
    }

    checkConsent()

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'cookieConsent') {
        checkConsent()
      }
    }

    const handleConsentChange = () => checkConsent()

    window.addEventListener('storage', handleStorageChange)
    window.addEventListener('cookieConsentChanged', handleConsentChange)

    return () => {
      window.removeEventListener('storage', handleStorageChange)
      window.removeEventListener('cookieConsentChanged', handleConsentChange)
    }
  }, [])

  if (!clarityId || !isAnalyticsGranted) {
    return null
  }

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
          })(window, document, "clarity", "script", "${clarityId}");
        `,
      }}
    />
  )
}

