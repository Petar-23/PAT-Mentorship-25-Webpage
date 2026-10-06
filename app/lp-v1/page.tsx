import HormoziLanding from '@/components/sections/hormozi-landing'
import type { Metadata } from 'next'

// Alte Landingpage. Nicht indexieren: Die Startseite ist die aktuelle Seite, die alten Texte sind nicht mehr freigegeben.
export const metadata: Metadata = {
  robots: { index: false, follow: true },
}

export default function LpV1Page() {
  return <HormoziLanding />
}
