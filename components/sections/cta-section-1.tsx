// src/components/sections/cta-section.tsx
'use client'

import { SignInButton, useUser } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { VortexBackground } from "@/components/ui/vortex-wrapper"
import { trackConversion } from '@/components/analytics/google-tag-manager'

export default function CTASection() {
  const { isSignedIn } = useUser()
  const router = useRouter()
  
  const handleScrollToDetails = () => {
    const target = document.getElementById('why-different')
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' })
    } else {
      window.location.hash = 'why-different'
    }
  }

  const handleClick = () => {
    trackConversion.ctaClick()
    if (isSignedIn) {
      router.push('/dashboard')
    }
  }
  
  const handleSignInClick = () => {
    trackConversion.ctaClick()
    trackConversion.signInStart()
  }

  return (
    <section className="py-16 sm:py-24 px-0 sm:px-4 bg-slate-950">
      <div className="container mx-auto max-w-6xl">
        <Card className="relative overflow-hidden bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6 sm:p-8 md:p-12 border-0">
          <VortexBackground />
          
          <div className="relative z-10">
            <div className="grid lg:grid-cols-2 gap-6 lg:gap-8 items-center">
              <div>
                <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4">
                  Bereit dein Trading zu transformieren?
                </h2>
                <p className="text-base sm:text-lg opacity-90 mb-6">
                  Trete jetzt der Warteliste bei und sichere dir als einer der Ersten deinen Platz
                  im Mentorship Programm 2026.
                </p>
                {isSignedIn ? (
                  <Button 
                    size="lg" 
                    className="w-full sm:w-auto bg-white text-slate-900 hover:bg-white/90"
                    onClick={handleClick}
                  >
                    Sichere dir deinen Platz
                  </Button>
                ) : (
                  <div className="flex flex-col gap-3">
                    <SignInButton mode="modal" forceRedirectUrl="/dashboard">
                      <Button 
                        size="lg" 
                        className="w-full sm:w-auto bg-white text-slate-900 hover:bg-white/90"
                        onClick={handleSignInClick}
                      >
                        Sichere dir deinen Platz
                      </Button>
                    </SignInButton>
                  </div>
                )}
              </div>
              
              <div className="space-y-4 sm:space-y-6">
                <div className="bg-white/5 backdrop-blur-sm rounded-lg p-4 border border-white/10">
                  <p className="font-medium">🎯 Limitiert auf 100 Plätze</p>
                  <p className="text-sm opacity-90">
                    Wir halten das Programm exklusiv, um qualitativ hochwertiges Mentoring zu gewährleisten.
                  </p>
                </div>
                <div className="bg-white/5 backdrop-blur-sm rounded-lg p-4 border border-white/10">
                  <p className="font-medium">🚀 Start im März 2026</p>
                  <p className="text-sm opacity-90">
                    Die Vergabe der Plätze erfolgt nach dem Prinzip: Wer zuerst kommt, mahlt zuerst.
                  </p>
                </div>
                <div className="bg-white/5 backdrop-blur-sm rounded-lg p-4 border border-white/10">
                  <p className="font-medium">💎 Kostenlose Reservierung</p>
                  <p className="text-sm opacity-90">
                    Dein Zahlungsmittel wird erst beim Start der Mentorship mit 150€/Monat (inkl. MwSt.) belastet. Du kannst jederzeit kündigen.
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