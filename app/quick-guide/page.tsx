"use client"

import { Suspense } from 'react'
import dynamic from 'next/dynamic'
import LeadMagnetHero from '@/components/sections/lead-magnet-hero'
import LeadMagnetSteps from '@/components/sections/lead-magnet-steps'
import LeadMagnetBenefits from '@/components/sections/lead-magnet-benefits'
import LeadMagnetFAQ from '@/components/sections/lead-magnet-faq'
import LeadMagnetForm from '@/components/sections/lead-magnet-form'
import { AuroraBackground } from '@/components/ui/aurora-background'

const AnimatedShaderBackground = dynamic(
  () => import('@/components/ui/animated-shader-background'),
  { ssr: false }
)

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
