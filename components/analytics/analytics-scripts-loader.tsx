'use client'

import dynamic from 'next/dynamic'
import { useEffect } from 'react'
import { markTrackingActive, useCookieConsent } from '@/lib/cookie-consent-client'
import { beforeVercelSend } from '@/lib/vercel-consent'

const GoogleTagManager = dynamic(
  () => import('@/components/analytics/google-tag-manager').then((mod) => mod.GoogleTagManager),
  { ssr: false }
)

const MicrosoftClarity = dynamic(
  () => import('@/components/analytics/microsoft-clarity').then((mod) => mod.MicrosoftClarity),
  { ssr: false }
)

const SpeedInsights = dynamic(
  () => import('@vercel/speed-insights/next').then((mod) => mod.SpeedInsights),
  { ssr: false }
)

const Analytics = dynamic(
  () => import('@vercel/analytics/react').then((mod) => mod.Analytics),
  { ssr: false }
)

export function AnalyticsScriptsLoader() {
  const consent = useCookieConsent()
  const analyticsGranted = consent?.analytics === true

  useEffect(() => {
    if (analyticsGranted) markTrackingActive('analytics')
  }, [analyticsGranted])

  return (
    <>
      <GoogleTagManager />
      <MicrosoftClarity />
      {analyticsGranted ? (
        <>
          <SpeedInsights beforeSend={beforeVercelSend} />
          <Analytics beforeSend={beforeVercelSend} />
        </>
      ) : null}
    </>
  )
}
