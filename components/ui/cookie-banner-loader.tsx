'use client'

import dynamic from 'next/dynamic'

const CookieBanner = dynamic(
  () => import('@/components/ui/cookie-banner').then((mod) => mod.CookieBanner),
  { ssr: false }
)

export function CookieBannerLoader() {
  return <CookieBanner />
}
