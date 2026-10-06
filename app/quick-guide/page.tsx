import { Suspense } from 'react'
import LeadMagnetHero from '@/components/sections/lead-magnet-hero'
import LeadMagnetSteps from '@/components/sections/lead-magnet-steps'
import LeadMagnetBenefits from '@/components/sections/lead-magnet-benefits'
import LeadMagnetFAQ from '@/components/sections/lead-magnet-faq'
import LeadMagnetForm from '@/components/sections/lead-magnet-form'
import { AuroraBackground } from '@/components/ui/aurora-background'
import AnimatedShaderBackground from '@/components/ui/animated-shader-background'
import type { Metadata } from 'next'

// Lead-Magnet für Links aus Videos und Posts. Vorerst nicht indexieren: Der Text verspricht ein Setup,
// "das du sofort anwenden kannst". Das passt nicht zu den eigenen M22-Prüfungen (C16, C22, C26) und braucht
// erst Petars Überarbeitung. Danach kann die Seite mit eigenem Canonical wieder in den Index.
export const metadata: Metadata = {
  title: 'ICT Modell 22 Quick-Start',
  description: 'Kostenloser Quick-Start zum ICT Modell 22: drei Videos und eine Checkliste per E-Mail.',
  robots: { index: false, follow: true },
}

export default function QuickGuidePage() {
  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:shadow"
      >
        Zum Inhalt springen
      </a>
      <main id="main" className="min-h-dvh bg-white text-neutral-950 overflow-x-hidden">
        <LeadMagnetHero />
        <AnimatedShaderBackground>
          <LeadMagnetSteps />
          <LeadMagnetBenefits />
        </AnimatedShaderBackground>
        <AuroraBackground className="h-auto min-h-0 overflow-hidden">
          <Suspense fallback={null}>
            <LeadMagnetFAQ />
            <LeadMagnetForm />
          </Suspense>
        </AuroraBackground>
      </main>
    </>
  )
}
