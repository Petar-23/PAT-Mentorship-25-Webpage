// src/components/sections/cta-section.tsx
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { VortexBackground } from "@/components/ui/vortex-wrapper"

export default function CTASection() {
  return (
    <section className="py-24 px-4 bg-slate-950">
      <div className="container mx-auto max-w-6xl">
        <Card className="relative overflow-hidden bg-gradient-to-r from-blue-600 to-purple-600 text-white p-8 md:p-12 border-0">
          <VortexBackground />
          
          <div className="relative z-10">
            <div className="grid lg:grid-cols-2 gap-8 items-center">
              <div>
                <h2 className="text-3xl md:text-4xl font-bold mb-4">
                  Ready to Transform Your Trading?
                </h2>
                <p className="text-lg opacity-90 mb-6">
                  Join our waitlist today and be among the first to secure your spot
                  in our 2025 Mentorship Program.
                </p>
                <Button 
                  size="lg" 
                  className="w-full sm:w-auto bg-white text-slate-900 hover:bg-white/90"
                >
                  Join Waitlist Now
                </Button>
              </div>
              
              <div className="space-y-6">
                <div className="bg-white/5 backdrop-blur-sm rounded-lg p-4 border border-white/10">
                  <p className="font-medium">🎯 Limited to 100 Spots</p>
                  <p className="text-sm opacity-90">
                    We keep our program exclusive to ensure quality mentorship
                  </p>
                </div>
                <div className="bg-white/5 backdrop-blur-sm rounded-lg p-4 border border-white/10">
                  <p className="font-medium">🚀 Starting March 2025</p>
                  <p className="text-sm opacity-90">
                    Early waitlist members get priority access
                  </p>
                </div>
                <div className="bg-white/5 backdrop-blur-sm rounded-lg p-4 border border-white/10">
                  <p className="font-medium">💎 Monthly Subscription</p>
                  <p className="text-sm opacity-90">
                    €150/month - Cancel anytime if not satisfied
                  </p>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </section>
  )
}