import type { Metadata } from 'next'
import RaidMapDocs from '@/components/sections/raidmap/docs'
import { RAIDMAP_CONFIG } from '@/lib/raidmap-config'

const baseUrl = 'https://www.price-action-trader.de'

export const metadata: Metadata = {
  title: 'PAT Raid Map — Documentation',
  description:
    'How to read the PAT Raid Map: DoL line, run-timing windows, purge detection, micro pools, terminus bands, confidence system and settings.',
  alternates: {
    canonical: `${baseUrl}${RAIDMAP_CONFIG.docsPathEn}`,
    languages: {
      en: `${baseUrl}${RAIDMAP_CONFIG.docsPathEn}`,
      de: `${baseUrl}${RAIDMAP_CONFIG.docsPathDe}`,
    },
  },
}

export default function RaidMapDocsPageEn() {
  return <RaidMapDocs lang="en" />
}
