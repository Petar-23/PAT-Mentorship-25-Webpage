'use client'

import dynamic from 'next/dynamic'
import { useIsResearchSurface } from '@/components/research/base-path'

const CookieBanner = dynamic(
  () => import('@/components/ui/cookie-banner').then((mod) => mod.CookieBanner),
  { ssr: false }
)

export function CookieBannerLoader() {
  // PAT Research setzt keine Tracking-Cookies und zeigt deshalb kein (deutsches) Banner.
  const isResearchSurface = useIsResearchSurface()
  return isResearchSurface === false ? <CookieBanner /> : null
}
