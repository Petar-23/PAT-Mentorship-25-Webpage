'use client'
import { MENTORSHIP_CONFIG } from '@/lib/config'
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Vortex } from "@/components/ui/vortex"

export default function WaitlistCTA() {
  return (
    <section id="join" className="py-20 px-4 md:px-6 bg-white">
      <div className="container mx-auto max-w-6xl">
        <div className="relative">
          <Card className="relative overflow-hidden bg-slate-900 text-white p-8 md:p-12">
            {/* Vortex Background */}
            <div className="absolute inset-0">
              <Vortex
                particleCount={500}
                baseHue={240}
                baseSpeed={0.2}
                rangeSpeed={1.0}
                baseRadius={0.5}
                rangeRadius={1.5}
                backgroundColor="transparent"
                containerClassName="opacity-30"
              />
            </div>
            
            {/* Content */}
            <div className="relative z-10">
              <div className="grid lg:grid-cols-2 gap-8 items-center">
                <div>
                  <h2 className="text-3xl md:text-4xl font-bold mb-4">
                    Ready to Transform Your Career?
                  </h2>
                  <p className="text-lg opacity-90 mb-6">
                    Join the current 2026 Mentorship Program anytime while places are still available.
                  </p>
                  <Button size="lg" variant="secondary" className="w-full sm:w-auto">
                    Join now
                  </Button>
                </div>
                <div className="space-y-6">
                  <div className="bg-black/10 backdrop-blur-sm rounded-lg p-4">
                    <p className="font-medium">🎯 Limited spots available</p>
                    <p className="text-sm opacity-90">
                      We keep our program exclusive to ensure quality mentorship
                    </p>
                  </div>
                  <div className="bg-black/10 backdrop-blur-sm rounded-lg p-4">
                    <p className="font-medium">
                      🚀 {MENTORSHIP_CONFIG.enrollmentLabelEn}
                    </p>
                    <p className="text-sm opacity-90">
                      Get access after your place is confirmed
                    </p>
                  </div>
                  <div className="bg-black/10 backdrop-blur-sm rounded-lg p-4">
                    <p className="font-medium">💎 Flexible monthly membership</p>
                    <p className="text-sm opacity-90">
                      Monthly billing with the option to cancel
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </section>
  )
}
