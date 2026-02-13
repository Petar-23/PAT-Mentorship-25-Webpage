import Hero from '@/components/sections/hero'
import WhyDifferent from '@/components/sections/why-different'
import ProgramStructure from '@/components/sections/program-structure'
import Mentor from '@/components/sections/mentor'
import Pricing from '@/components/sections/pricing'
import PricingComparison from '@/components/sections/pricing-comparison'
import Testimonials from '@/components/sections/testimonials'
import Faq from '@/components/sections/faq'
import FinalCTA from '@/components/sections/final-cta'

export default function HomePage() {
  return (
    <main className="bg-white text-slate-900">
      <Hero />
      <WhyDifferent />
      <Testimonials />
      <Pricing />
      <Mentor />
      <PricingComparison />
      <ProgramStructure />
      <Faq />
      <FinalCTA />
    </main>
  )
}