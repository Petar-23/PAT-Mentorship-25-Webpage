import type { Metadata } from 'next'
import { LandingV3 } from '@/components/landing-v3/landing-v3'
import { WHOP_FALLBACK } from '@/components/landing-v3/content'
import type { LandingReviews } from '@/components/landing-v3/types'
import { MENTORSHIP_CONFIG } from '@/lib/config'
import { getWhopReviewSummary } from '@/lib/whop-reviews-server'

// Statisch mit stündlicher Aktualisierung (Whop-Zahl). Kein Cookie- oder Header-Zugriff, damit die Seite aus dem Cache kommt.
export const revalidate = 3600

const TITLE = 'PAT Mentorship 2026: ICT verstehen. Auf Deutsch. Schritt für Schritt.'
const DESCRIPTION = `Ich erkläre dir die Konzepte von ICT in einem klaren Lehrplan, auf Deutsch und Schritt für Schritt. Zwei Live-Sessions pro Woche, ${MENTORSHIP_CONFIG.price} € pro Monat inkl. MwSt., monatlich kündbar.`

// Startseite: indexierbar (robots aus app/layout.tsx), Canonical auf sich selbst.
export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    locale: 'de_DE',
    url: '/',
    siteName: 'Price Action Trader',
    title: TITLE,
    description: DESCRIPTION,
    images: [{ url: '/images/pat-banner.jpeg', alt: 'PAT Mentorship 2026' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
    images: ['/images/pat-banner.jpeg'],
  },
}

async function loadReviews(): Promise<LandingReviews> {
  const summary = await getWhopReviewSummary({ revalidate })
  const count = summary?.count ?? WHOP_FALLBACK.count
  const average = summary?.average ?? WHOP_FALLBACK.average
  return { count, average, countLabel: count >= 200 ? '200+' : String(count) }
}

export default async function HomePage() {
  const reviews = await loadReviews()
  return <LandingV3 reviews={reviews} />
}
