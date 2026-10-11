import type { Metadata, Viewport } from 'next'
import localFont from 'next/font/local'
import { Sora } from 'next/font/google'
import './globals.css'
import { ToasterLoader } from '@/components/ui/toaster-loader'
import { Navbar } from '@/components/layout/navbar'
import { Footer } from '@/components/layout/footer'
import { LocalizedClerkProvider } from '@/components/layout/localized-clerk-provider'
import { CookieBannerLoader } from '@/components/ui/cookie-banner-loader'
import { AnalyticsScriptsLoader } from '@/components/analytics/analytics-scripts-loader'
import { JsonLd } from '@/components/seo/json-ld'
import { siteGraph } from '@/lib/structured-data.mjs'
import { Suspense, lazy } from 'react'
import { CURRENT_BUNNY_THUMBNAIL_HOST } from '@/lib/bunny-thumbnail'
import { MENTORSHIP_CONFIG } from '@/lib/config'
import { CheckoutModeProvider } from '@/components/checkout/checkout-mode'
import { isGuestCheckoutEnabled } from '@/lib/checkout-mode'

// Agentation nur in Development laden (ist devDependency)
const Agentation = process.env.NODE_ENV === 'development' 
  ? lazy(() => import('agentation').then(mod => ({ default: mod.Agentation })))
  : () => null

const geistSans = localFont({
  src: './fonts/GeistVF.woff',
  variable: '--font-geist-sans',
  display: 'swap',
})

const geistMono = localFont({
  src: './fonts/GeistMonoVF.woff',
  variable: '--font-geist-mono',
  display: 'swap',
  // Only fetch this face when a page actually renders monospaced text.
  preload: false,
})

const sora = Sora({ 
  subsets: ['latin'],
  variable: '--font-sora',
  weight: ['400', '600', '700'],
})

const DEFAULT_TITLE = 'PAT Mentorship 2026: ICT verstehen. Auf Deutsch. Schritt für Schritt.'
const DEFAULT_DESCRIPTION = `Die Konzepte von ICT in einem klaren Lehrplan, auf Deutsch und Schritt für Schritt. ${MENTORSHIP_CONFIG.sessionsPerWeek} Live-Sessions pro Woche, ${MENTORSHIP_CONFIG.price} € pro Monat inkl. MwSt., monatlich kündbar.`

// Kein Canonical und keine og:url hier: Sonst erben alle Seiten ohne eigene Angabe den Canonical der Startseite
// und sagen Google damit, sie seien ein Duplikat von "/". Jede indexierbare Seite setzt ihren Canonical selbst.
export const metadata: Metadata = {
  metadataBase: new URL('https://www.price-action-trader.de'),
  title: {
    default: DEFAULT_TITLE,
    template: '%s | PAT Mentorship',
  },
  description: DEFAULT_DESCRIPTION,
  keywords: ['ICT Trading', 'ICT auf Deutsch', 'ICT Mentorship Deutsch', 'Smart Money Concepts', 'Fair Value Gap', 'Trading Mentoring Deutsch'],
  authors: [{ name: 'Petar Maric', url: 'https://www.price-action-trader.de/#petar' }],
  creator: 'Price Action Trader',
  publisher: 'Price Action Trader',
  openGraph: {
    type: 'website',
    locale: 'de_DE',
    siteName: 'Price Action Trader',
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    // Das Bild ist 618 × 685 px. Keine falschen Maße angeben (vorher 1200 × 630).
    images: [{ url: '/images/pat-banner.jpeg', alt: 'PAT Mentorship 2026' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
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
    <LocalizedClerkProvider>
      <html lang="de" className="h-full scroll-smooth">
        <head>
          <link rel="preconnect" href={`https://${CURRENT_BUNNY_THUMBNAIL_HOST}`} crossOrigin="" />
          <link rel="preconnect" href="https://iframe.mediadelivery.net" crossOrigin="" />
          <JsonLd data={siteGraph()} />
        </head>
        <body className={`${geistSans.variable} ${geistMono.variable} ${sora.variable} font-sans antialiased h-full overflow-x-hidden`}>
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-md focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-slate-900 focus:shadow-lg"
          >
            Zum Inhalt springen
          </a>
          <CheckoutModeProvider guestCheckout={isGuestCheckoutEnabled()}>
            <div className="min-h-full flex flex-col">
              <Navbar />
              <main id="main-content" className="flex-1 min-h-0">
                {children}
              </main>
              <Footer />
            </div>
          </CheckoutModeProvider>
          <ToasterLoader />
          <CookieBannerLoader />
          <AnalyticsScriptsLoader />
          {process.env.NODE_ENV === 'development' && (
            <Suspense fallback={null}>
              <Agentation />
            </Suspense>
          )}
        </body>
      </html>
    </LocalizedClerkProvider>
  )
}
