import type { Metadata } from 'next'
import { PFADE } from '@/components/prop-firm-rechner/pfade'
import { RechnerSeite } from '@/components/prop-firm-rechner/seite'

const TITLE = 'Prop Firm Calculator: What win rate do you need for your goal?'
const DESCRIPTION =
  'Free prop firm calculator: pick your goal, time frame and trades per week. After six questions you see the win rate ' +
  'you need and which account from Topstep, MyFundedFutures, Tradeify, MyFundedPerps or Vest gets you there most easily, ' +
  'after all fees.'
const IMAGE = { url: '/images/og/prop-firm-rechner-en.png', width: 1200, height: 630, alt: 'Prop firm calculator: What win rate do you need for your goal?' }

export const metadata: Metadata = {
  // absolute: the site-wide title template appends the German mentorship name
  title: { absolute: `${TITLE} | Price Action Trader` },
  description: DESCRIPTION,
  alternates: {
    canonical: PFADE.en,
    languages: { de: PFADE.de, en: PFADE.en, 'x-default': PFADE.de },
  },
  keywords: ['prop firm calculator', 'prop firm comparison', 'Topstep', 'MyFundedFutures', 'Tradeify', 'funded account', 'trading combine', 'prop trading'],
  openGraph: {
    type: 'website',
    locale: 'en_US',
    alternateLocale: ['de_DE'],
    url: PFADE.en,
    siteName: 'Price Action Trader',
    title: TITLE,
    description: DESCRIPTION,
    images: [IMAGE],
  },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION, images: [IMAGE] },
}

export default function PropFirmCalculatorPage() {
  return <RechnerSeite sprache="en" />
}
