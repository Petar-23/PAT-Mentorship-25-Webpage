// src/components/sections/cta-section.tsx
'use client'

import { Card } from "@/components/ui/card"
import { VortexBackground } from "@/components/ui/vortex-wrapper"
import { MentorshipEntryCta } from '@/components/sections/mentorship-entry-cta'
import { MENTORSHIP_CONFIG, MENTORSHIP_IS_UPCOMING } from '@/lib/config'

export default function CTASection() {
  return (
    <section className="py-16 sm:py-24 px-0 sm:px-4 bg-slate-950">
      <div className="container mx-auto max-w-6xl">
        <Card className="relative overflow-hidden bg-slate-900 text-white p-6 sm:p-8 md:p-12 border-0">
          <VortexBackground />
          
          <div className="relative z-10">
            <div className="grid lg:grid-cols-2 gap-6 lg:gap-8 items-center">
              <div>
                <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4">
                  Bereit dein Trading zu transformieren?
                </h2>
                <p className="text-base sm:text-lg opacity-90 mb-6">
                  {MENTORSHIP_IS_UPCOMING
                    ? 'Trete jetzt der Warteliste bei und sichere dir als einer der Ersten deinen Platz im Mentorship Programm 2026.'
                    : 'Steige in die laufende Mentorship 2026 ein und prüfe alle Konditionen vor der Buchung.'}
                </p>
                <MentorshipEntryCta
                  source="section_cta"
                  className="w-full bg-white text-slate-900 hover:bg-white/90 sm:w-auto"
                />
                <p className="mt-3 text-xs text-slate-300 sm:text-sm">
                  Kostenlos anmelden → Konditionen prüfen → sicher über Stripe buchen
                </p>
              </div>
              
              <div className="space-y-3 sm:space-y-6">
                <div className="bg-white/5 backdrop-blur-sm rounded-lg p-3 sm:p-4 border border-white/10">
                  <p className="text-sm sm:text-base font-medium">🎯 Fokussierte Community</p>
                  <p className="text-xs sm:text-sm opacity-90">
                    Austausch, Rückfragen und direktes Feedback begleiten deinen Lernprozess.
                  </p>
                </div>
                <div className="bg-white/5 backdrop-blur-sm rounded-lg p-3 sm:p-4 border border-white/10">
                  <p className="text-sm sm:text-base font-medium">
                    🚀 {MENTORSHIP_IS_UPCOMING ? `Start im ${MENTORSHIP_CONFIG.startMonthYear}` : MENTORSHIP_CONFIG.enrollmentLabel}
                  </p>
                  <p className="text-xs sm:text-sm opacity-90">
                    Der Einstieg in den laufenden Jahrgang ist aktuell möglich.
                  </p>
                </div>
                <div className="bg-white/5 backdrop-blur-sm rounded-lg p-3 sm:p-4 border border-white/10">
                  <p className="text-sm sm:text-base font-medium">
                    💎 {MENTORSHIP_IS_UPCOMING ? 'Kostenlose Reservierung' : 'Flexibles Monatsabo'}
                  </p>
                  <p className="text-xs sm:text-sm opacity-90">
                    {MENTORSHIP_IS_UPCOMING
                      ? `Dein Zahlungsmittel wird erst beim Start der Mentorship mit ${MENTORSHIP_CONFIG.price}€/Monat (inkl. MwSt.) belastet. Kündbar mit 1 Tag Frist zum Monatsende.`
                      : `${MENTORSHIP_CONFIG.price}€/Monat (inkl. MwSt.). Kündbar mit 1 Tag Frist zum Monatsende.`}
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
