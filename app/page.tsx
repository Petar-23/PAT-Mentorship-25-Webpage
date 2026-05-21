import Hero from '@/components/sections/hero'
import WhyDifferent from '@/components/sections/why-different'
import ProgramStructure from '@/components/sections/program-structure'
import Mentor from '@/components/sections/mentor'
import Pricing from '@/components/sections/pricing'
import PricingComparison from '@/components/sections/pricing-comparison'
import LazyTestimonialsSection from '@/components/sections/lazy-testimonials-section'
import Faq from '@/components/sections/faq'
import LazyFinalCtaSection from '@/components/sections/lazy-final-cta-section'

export default function HomePage() {
  return (
    <main className="bg-white text-slate-900">
      <Hero />
      <WhyDifferent />
      <LazyTestimonialsSection />
      <Pricing />
      <Mentor />
      <PricingComparison />
      <ProgramStructure />
      <Faq />
      <LazyFinalCtaSection />
    </main>
  )
}
