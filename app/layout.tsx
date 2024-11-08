import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Toaster } from '@/components/ui/toaster'
import { Navbar } from '@/components/layout/navbar'
import { Footer } from '@/components/layout/footer'
import {ClerkProvider} from '@clerk/nextjs'
import { CookieBanner } from '@/components/ui/cookie-banner'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'PAT Mentorship 2025',
  description: 'Trete meiner ICT Mentorship 2025 bei, und lerne profitabel zu handeln.',
  keywords: ['mentorship', 'trading', 'day trading', 'professional development'],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ClerkProvider>
      <html lang="en" className="h-full scroll-smooth">
        <body className={`${inter.className} h-full`}>
          <div className="min-h-full flex flex-col">
            <Navbar />
            <main className="flex-1">
              {children}
            </main>
            <Footer />
          </div>
          <Toaster />
          <CookieBanner />
        </body>
      </html>
    </ClerkProvider>
  )
}