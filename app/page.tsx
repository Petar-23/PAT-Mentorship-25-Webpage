import Hero from '@/components/sections/hero'
import WhyDifferent from '@/components/sections/why-different'
import ProgramStructure from '@/components/sections/program-structure'
import CTASection from '@/components/sections/cta-section-1'
import Testimonials from '@/components/sections/testimonials'
import PricingComparison from '@/components/sections/pricing-comparison'
import FAQ from '@/components/sections/faq'
import FinalCTA from '@/components/sections/final-cta'

export default function HomePage() {
  return (
    <main className="min-h-screen">
      <Hero />
      <WhyDifferent />
      <PricingComparison />
      <ProgramStructure />
      <CTASection />
      <Testimonials />
      <FAQ />
      <FinalCTA />
    </main>
  )
}