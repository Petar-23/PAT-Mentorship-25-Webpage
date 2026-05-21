'use client'

import dynamic from 'next/dynamic'

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
  return (
    <>
      <GoogleTagManager />
      <MicrosoftClarity />
      <SpeedInsights />
      <Analytics />
    </>
  )
}
