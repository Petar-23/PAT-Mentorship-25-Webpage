import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
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
import { Suspense } from 'react'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'PAT Mentorship 2026',
  description: 'Lerne Trading nach ICT Konzepten, Live und auf Deutsch',
  keywords: ['mentorship', 'trading', 'day trading', 'professional development', 'ICT'],
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon.ico',
    apple: '/favicon.ico',
  }
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ClerkProvider afterSignOutUrl={"/"} localization={deDE} signInFallbackRedirectUrl="/dashboard" signUpFallbackRedirectUrl="/dashboard">
      <html lang="en" className="h-full scroll-smooth">
        <body className={`${inter.className} h-full`}>
          <div className="min-h-full flex flex-col">
            <Suspense fallback={<div className="h-16 w-full" />}>
              <Navbar />
            </Suspense>
            <main className="flex-1 min-h-0">
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
        </body>
      </html>
    </ClerkProvider>
  )
}