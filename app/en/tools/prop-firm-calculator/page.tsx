import type { Metadata } from 'next'
import { PFADE } from '@/components/prop-firm-rechner/pfade'
import { RechnerSeite } from '@/components/prop-firm-rechner/seite'

const TITLE = 'Prop Firm Calculator: Which prop firm fits your trades?'
const DESCRIPTION =
  'Free prop firm calculator: enter your win rate and R values and see, for 140 account types from Topstep, ' +
  'MyFundedFutures, Tradeify, MyFundedPerps and Vest, how often you pass, when the first payout comes and what is ' +
  'left after all fees. With an honest luck check.'

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
    images: [{ url: '/images/pat-banner.jpeg', alt: 'Prop firm calculator by Price Action Trader' }],
  },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION, images: ['/images/pat-banner.jpeg'] },
}

export default function PropFirmCalculatorPage() {
  return <RechnerSeite sprache="en" />
}
