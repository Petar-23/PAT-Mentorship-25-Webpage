import Hero from '@/components/sections/hero'
import WhyDifferent from '@/components/sections/why-different'
import ProgramStructure from '@/components/sections/program-structure'
import Mentor from '@/components/sections/mentor'
import Pricing from '@/components/sections/pricing'
import Testimonials from '@/components/sections/testimonials'
import Faq from '@/components/sections/faq'
import FinalCTA from '@/components/sections/final-cta'

export default function LpV2Page() {
  return (
    <main className="bg-white text-slate-900">
      <Hero />
      <WhyDifferent />
      <ProgramStructure />
      <Mentor />
      <Pricing />
      <Testimonials />
      <Faq />
      <FinalCTA />
    </main>
  )
}
