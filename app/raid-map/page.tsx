import type { Metadata } from 'next'
import RaidMapHero from '@/components/sections/raidmap/hero'
import RaidMapStory from '@/components/sections/raidmap/story'
import RaidMapFeatures from '@/components/sections/raidmap/features'
import RaidMapPricing from '@/components/sections/raidmap/pricing'
import RaidMapFaq from '@/components/sections/raidmap/faq'
import { RaidMapSuccessDialog } from '@/components/sections/raidmap/success-dialog'
import { Suspense } from 'react'
import fs from 'fs'
import path from 'path'
import { RAIDMAP_CONFIG } from '@/lib/raidmap-config'
import { raidmapMeta } from '@/lib/raidmap-content'

const baseUrl = 'https://www.price-action-trader.de'

export const metadata: Metadata = {
  title: raidmapMeta.en.title,
  description: raidmapMeta.en.description,
  alternates: {
    canonical: `${baseUrl}${RAIDMAP_CONFIG.salesPathEn}`,
    languages: {
      en: `${baseUrl}${RAIDMAP_CONFIG.salesPathEn}`,
      de: `${baseUrl}${RAIDMAP_CONFIG.salesPathDe}`,
    },
  },
  openGraph: {
    title: raidmapMeta.en.title,
    description: raidmapMeta.en.description,
    url: `${baseUrl}${RAIDMAP_CONFIG.salesPathEn}`,
    locale: 'en_US',
    type: 'website',
  },
}

const productJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Product',
  name: `${RAIDMAP_CONFIG.productName} [${RAIDMAP_CONFIG.betaTag}]`,
  description: raidmapMeta.en.description,
  brand: { '@type': 'Brand', name: 'Price Action Trader' },
  offers: [
    {
      '@type': 'Offer',
      price: RAIDMAP_CONFIG.monthlyPrice,
      priceCurrency: RAIDMAP_CONFIG.currency,
      url: `${baseUrl}${RAIDMAP_CONFIG.salesPathEn}`,
      availability: 'https://schema.org/InStock',
    },
    {
      '@type': 'Offer',
      price: RAIDMAP_CONFIG.annualTotal,
      priceCurrency: RAIDMAP_CONFIG.currency,
      url: `${baseUrl}${RAIDMAP_CONFIG.salesPathEn}`,
      availability: 'https://schema.org/InStock',
    },
  ],
}

export default function RaidMapPageEn() {
  const hasGuideImage = fs.existsSync(path.join(process.cwd(), 'public', RAIDMAP_CONFIG.guideImagePath))
  return (
    <main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }}
      />
      <Suspense fallback={null}>
        <RaidMapSuccessDialog lang="en" hasGuideImage={hasGuideImage} />
      </Suspense>
      <RaidMapHero lang="en" />
      <RaidMapStory lang="en" />
      <RaidMapFeatures lang="en" />
      <RaidMapPricing lang="en" />
      <RaidMapFaq lang="en" />
    </main>
  )
}
