'use client'

import dynamic from 'next/dynamic'
import { useIsResearchSurface } from '@/components/research/base-path'

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
  // PAT Research: kein Google Tag und kein Clarity, nur cookielose Vercel-Messung.
  // Die Haupt-Seite lädt beide wie bisher (ssr: false, also ohnehin erst im Browser).
  const isResearchSurface = useIsResearchSurface()

  return (
    <>
      {isResearchSurface === false ? (
        <>
          <GoogleTagManager />
          <MicrosoftClarity />
        </>
      ) : null}
      <SpeedInsights />
      <Analytics />
    </>
  )
}
