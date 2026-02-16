import type { Metadata, Viewport } from 'next'
import { Inter, Sora } from 'next/font/google'
import './globals.css'
import { Toaster } from '@/components/ui/toaster'
import { Navbar } from '@/components/layout/navbar'
import { FooterGate } from '@/components/layout/footer-gate'
import {ClerkProvider} from '@clerk/nextjs'
import { deDE } from '@clerk/localizations'
import { CookieBanner } from '@/components/ui/cookie-banner'
import { SpeedInsights } from '@vercel/speed-insights/next';
import { Analytics } from '@vercel/analytics/react'
import { GoogleTagManager } from '@/components/analytics/google-tag-manager'
import { MicrosoftClarity } from '@/components/analytics/microsoft-clarity'
import { JsonLd } from '@/components/seo/json-ld'
import { Suspense, lazy } from 'react'

// Agentation nur in Development laden (ist devDependency)
const Agentation = process.env.NODE_ENV === 'development' 
  ? lazy(() => import('agentation').then(mod => ({ default: mod.Agentation })))
  : () => null

const inter = Inter({ 
  subsets: ['latin'],
  variable: '--font-inter',
})

const sora = Sora({ 
  subsets: ['latin'],
  variable: '--font-sora',
  weight: ['400', '600', '700'],
})

export const metadata: Metadata = {
  metadataBase: new URL('https://www.price-action-trader.de'),
  title: {
    default: 'PAT Mentorship 2026 | Trading nach ICT Konzepten lernen — Live & auf Deutsch',
    template: '%s | PAT Mentorship',
  },
  description: 'Lerne Trading nach ICT Smart Money Konzepten im Live-Mentoring. 2-3 Sessions pro Woche, auf Deutsch. 130+ erfolgreiche Absolventen. Monatlich kündbar.',
  keywords: ['ICT Trading', 'Smart Money Concept', 'Price Action Trading', 'Trading Mentoring Deutsch', 'Live Trading lernen', 'ICT auf Deutsch', 'Trading Ausbildung'],
  authors: [{ name: 'Petar', url: 'https://www.price-action-trader.de' }],
  creator: 'Price Action Trader',
  publisher: 'Price Action Trader',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    locale: 'de_DE',
    url: 'https://www.price-action-trader.de',
    siteName: 'Price Action Trader',
    title: 'PAT Mentorship 2026 | ICT Trading Live & auf Deutsch',
    description: 'Lerne Trading nach ICT Smart Money Konzepten im Live-Mentoring. 2-3 Sessions/Woche, deutschsprachig, monatlich kündbar.',
    images: [
      {
        url: '/images/pat-banner.jpeg',
        width: 1200,
        height: 630,
        alt: 'PAT Mentorship 2026 — Live Trading Mentoring nach ICT Konzepten',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'PAT Mentorship 2026 | ICT Trading Live & auf Deutsch',
    description: 'Live-Mentoring für Trading nach ICT Smart Money Konzepten. 130+ erfolgreiche Absolventen.',
    images: ['/images/pat-banner.jpeg'],
  },
  verification: {
    google: 'A8fxOO5cODNTVq9Gc-qoq97pX1rLML0uwLXhFV6o58g',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon.ico',
    apple: '/favicon.ico',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ClerkProvider afterSignOutUrl={"/"} localization={deDE} signInFallbackRedirectUrl="/dashboard" signUpFallbackRedirectUrl="/dashboard">
      <html lang="de" className="h-full scroll-smooth">
        <head>
          <JsonLd />
        </head>
        <body className={`${inter.variable} ${sora.variable} font-sans h-full overflow-x-hidden`}>
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-md focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-slate-900 focus:shadow-lg"
          >
            Zum Inhalt springen
          </a>
          <div className="min-h-full flex flex-col">
            <Suspense fallback={<div className="h-16 w-full" />}>
              <Navbar />
            </Suspense>
            <main id="main-content" className="flex-1 min-h-0">
              {children}
            </main>
            <FooterGate />
          </div>
          <Toaster />
          <CookieBanner />
          <GoogleTagManager />
          <MicrosoftClarity />
          <SpeedInsights />
          <Analytics />
          {process.env.NODE_ENV === 'development' && (
            <Suspense fallback={null}>
              <Agentation />
            </Suspense>
          )}
        </body>
      </html>
    </ClerkProvider>
  )
}