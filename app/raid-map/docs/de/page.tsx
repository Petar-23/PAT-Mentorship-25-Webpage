import type { Metadata } from 'next'
import RaidMapDocs from '@/components/sections/raidmap/docs'
import { RAIDMAP_CONFIG } from '@/lib/raidmap-config'

const baseUrl = 'https://www.price-action-trader.de'

export const metadata: Metadata = {
  title: 'PAT Raid Map — Dokumentation',
  description:
    'So liest du die PAT Raid Map: DoL-Linie, Run-Timing-Fenster, Purge-Erkennung, Mikro-Pools, Terminus-Bänder, Confidence-System und Einstellungen.',
  alternates: {
    canonical: `${baseUrl}${RAIDMAP_CONFIG.docsPathDe}`,
    languages: {
      en: `${baseUrl}${RAIDMAP_CONFIG.docsPathEn}`,
      de: `${baseUrl}${RAIDMAP_CONFIG.docsPathDe}`,
    },
  },
}

export default function RaidMapDocsPageDe() {
  return <RaidMapDocs lang="de" />
}
