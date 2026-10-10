import type { Metadata } from 'next'
import { landingSans, landingSerif } from '@/components/landing-v3/fonts'
import { Hintergrund } from '@/components/prop-firm-rechner/hintergrund'
import { PropFirmRechner } from '@/components/prop-firm-rechner/rechner'
import { datum } from '@/components/prop-firm-rechner/texte'
import '@/components/prop-firm-rechner/rechner.css'
import rohDaten from '@/lib/prop-firm/daten/regeln-2026-10-09.json'
import { FIRMEN, type RegelDaten } from '@/lib/prop-firm/konten'

const DATEN = rohDaten as unknown as RegelDaten
const TITEL = 'Prop-Firm-Rechner: Welche Prop-Firma passt zu deinen Trades?'
const BESCHREIBUNG =
  'Kostenloser Prop-Firm-Rechner auf Deutsch: Trefferquote und R-Werte eingeben und für 140 Kontotypen von Topstep, ' +
  'MyFundedFutures, Tradeify, MyFundedPerps und Vest sehen, wie oft du bestehst, wann die erste Auszahlung kommt und ' +
  'was nach allen Gebühren bleibt. Mit ehrlichem Glücksvergleich.'

export const metadata: Metadata = {
  title: TITEL,
  description: BESCHREIBUNG,
  alternates: { canonical: '/tools/prop-firm-rechner' },
  keywords: ['Prop Firm Rechner', 'Prop Firm Vergleich', 'Topstep', 'MyFundedFutures', 'Tradeify', 'Funded Account', 'Trading Combine', 'Prop Trading Deutsch'],
  openGraph: {
    type: 'website',
    locale: 'de_DE',
    url: '/tools/prop-firm-rechner',
    siteName: 'Price Action Trader',
    title: TITEL,
    description: BESCHREIBUNG,
    images: [{ url: '/images/pat-banner.jpeg', alt: 'Prop-Firm-Rechner von Price Action Trader' }],
  },
  twitter: { card: 'summary_large_image', title: TITEL, description: BESCHREIBUNG, images: ['/images/pat-banner.jpeg'] },
}

export default function PropFirmRechnerPage() {
  const anzahl = DATEN.konten.length
  return (
    <div className={`pfr ${landingSans.variable} ${landingSerif.variable}`}>
      <header className="wrap kopf">
        <p className="kicker">Werkzeug · kostenlos · rechnet in deinem Browser</p>
        <h1>Prop-Firm-Rechner</h1>
        <p className="lead">
          Welche Prop-Firma passt zu deinen Trades? Gib Trefferquote, Gewinn und Verlust in R ein. Der Rechner spielt
          tausende Handelsjahre gegen die Regeln von {anzahl} Kontotypen durch, mit allen Gebühren, und zeigt dir ehrlich,
          wie viel davon Glück wäre.
        </p>
        <div className="meta">
          <span className="chip">Regelstand {datum(DATEN.stand)}</span>
          <span className="chip">{FIRMEN.join(', ')}</span>
          <span className="chip">Keine Finanzberatung</span>
        </div>
      </header>
      <PropFirmRechner />
      <Hintergrund daten={DATEN} />
    </div>
  )
}
