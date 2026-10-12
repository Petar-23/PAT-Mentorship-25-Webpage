import type { Metadata } from 'next'
import { PFADE } from '@/components/prop-firm-rechner/pfade'
import { RechnerSeite } from '@/components/prop-firm-rechner/seite'

const TITEL = 'Prop-Firm-Rechner: Welche Trefferquote brauchst du für dein Ziel?'
const BESCHREIBUNG =
  'Kostenloser Prop-Firm-Rechner: Ziel, Zeitraum und Trades pro Woche wählen. Nach sechs Fragen siehst du, welche ' +
  'Trefferquote du brauchst und welches Konto von Topstep, MyFundedFutures, Tradeify, MyFundedPerps oder Vest am ' +
  'leichtesten reicht, nach allen Gebühren.'
const BILD = { url: '/images/og/prop-firm-rechner-de.png', width: 1200, height: 630, alt: 'Prop-Firm-Rechner: Welche Trefferquote brauchst du für dein Ziel?' }

export const metadata: Metadata = {
  title: TITEL,
  description: BESCHREIBUNG,
  alternates: {
    canonical: PFADE.de,
    languages: { de: PFADE.de, en: PFADE.en, 'x-default': PFADE.de },
  },
  keywords: ['Prop Firm Rechner', 'Prop Firm Vergleich', 'Topstep', 'MyFundedFutures', 'Tradeify', 'Funded Account', 'Trading Combine', 'Prop Trading Deutsch'],
  openGraph: {
    type: 'website',
    locale: 'de_DE',
    alternateLocale: ['en_US'],
    url: PFADE.de,
    siteName: 'Price Action Trader',
    title: TITEL,
    description: BESCHREIBUNG,
    images: [BILD],
  },
  twitter: { card: 'summary_large_image', title: TITEL, description: BESCHREIBUNG, images: [BILD] },
}

export default function PropFirmRechnerPage() {
  return <RechnerSeite sprache="de" />
}
