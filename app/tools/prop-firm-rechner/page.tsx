import type { Metadata } from 'next'
import { PFADE } from '@/components/prop-firm-rechner/pfade'
import { RechnerSeite } from '@/components/prop-firm-rechner/seite'

const TITEL = 'Prop-Firm-Rechner: Welche Prop-Firma passt zu deinen Trades?'
const BESCHREIBUNG =
  'Kostenloser Prop-Firm-Rechner auf Deutsch: Trefferquote und R-Werte eingeben und für 140 Kontotypen von Topstep, ' +
  'MyFundedFutures, Tradeify, MyFundedPerps und Vest sehen, wie oft du bestehst, wann die erste Auszahlung kommt und ' +
  'was nach allen Gebühren bleibt. Mit ehrlichem Vergleich ohne Kante.'

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
    images: [{ url: '/images/pat-banner.jpeg', alt: 'Prop-Firm-Rechner von Price Action Trader' }],
  },
  twitter: { card: 'summary_large_image', title: TITEL, description: BESCHREIBUNG, images: ['/images/pat-banner.jpeg'] },
}

export default function PropFirmRechnerPage() {
  return <RechnerSeite sprache="de" />
}
