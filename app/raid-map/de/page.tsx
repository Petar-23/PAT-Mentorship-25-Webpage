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
  title: raidmapMeta.de.title,
  description: raidmapMeta.de.description,
  alternates: {
    canonical: `${baseUrl}${RAIDMAP_CONFIG.salesPathDe}`,
    languages: {
      en: `${baseUrl}${RAIDMAP_CONFIG.salesPathEn}`,
      de: `${baseUrl}${RAIDMAP_CONFIG.salesPathDe}`,
    },
  },
  openGraph: {
    title: raidmapMeta.de.title,
    description: raidmapMeta.de.description,
    url: `${baseUrl}${RAIDMAP_CONFIG.salesPathDe}`,
    locale: 'de_DE',
    type: 'website',
  },
}

export default function RaidMapPageDe() {
  const hasGuideImage = fs.existsSync(path.join(process.cwd(), 'public', RAIDMAP_CONFIG.guideImagePath))
  return (
    <main>
      <Suspense fallback={null}>
        <RaidMapSuccessDialog lang="de" hasGuideImage={hasGuideImage} />
      </Suspense>
      <RaidMapHero lang="de" />
      <RaidMapStory lang="de" />
      <RaidMapFeatures lang="de" />
      <RaidMapPricing lang="de" />
      <RaidMapFaq lang="de" />
    </main>
  )
}
