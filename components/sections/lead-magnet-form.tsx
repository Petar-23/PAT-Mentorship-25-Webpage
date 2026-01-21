import Link from 'next/link'
import LeadMagnetSignupForm from '@/components/sections/lead-magnet-signup-form'
import { AuroraBackground } from '@/components/ui/aurora-background'
import { HeroPill } from '@/components/ui/hero-pill'
import { GlassCard } from '@/components/ui/glass-card'

export default function LeadMagnetForm() {
  return (
    <AuroraBackground 
      id="lead-magnet-form"
      className="scroll-mt-24 h-auto min-h-0 overflow-hidden px-5 py-16 sm:px-6 sm:py-24"
    >
      <div className="mx-auto w-full max-w-4xl min-w-0">
        <div className="grid min-w-0 gap-8 lg:grid-cols-[1.2fr_1fr]">
          <div className="min-w-0">
            <div className="w-fit">
              <HeroPill 
                announcement="🎯" 
                label="Starte Heute Kostenlos" 
              />
            </div>
            <h2 className="text-balance mt-4 text-3xl font-semibold text-neutral-950 sm:text-4xl">
              Hol Dir Video 1, Checkliste & Trading‑Plan
            </h2>
            <p className="text-pretty mt-4 text-base text-neutral-700 sm:text-lg">
              Du bekommst Video 1 sofort per E‑Mail. Video 2 und 3 folgen an den
              nächsten Tagen. Alles ist bewusst kompakt, damit du die Grundlagen
              sauber aufbaust.
            </p>
            <ul className="mt-6 space-y-2 text-pretty text-sm text-neutral-700">
              <li>• 3 klare Videos statt 700+ Chaos</li>
              <li>• PDF‑Checkliste plus Trading‑Plan</li>
              <li>• Einfache Abmeldung mit einem Klick</li>
            </ul>
          </div>
          <GlassCard className="min-w-0 w-full">
            <h3 className="text-balance text-xl font-semibold text-neutral-950">
              Kostenlos Anmelden
            </h3>
            <p className="text-pretty mt-2 text-sm text-neutral-600">
              Trage dich ein und starte sofort.
            </p>
            <LeadMagnetSignupForm className="mt-6" idPrefix="lead-magnet-section" />
            <p className="text-pretty mt-4 text-xs text-neutral-500">
              Mit dem Eintrag stimmst du unserer{' '}
              <Link href="/datenschutz" className="underline underline-offset-4">
                Datenschutzerklärung
              </Link>{' '}
              zu.
            </p>
          </GlassCard>
        </div>
      </div>
    </AuroraBackground>
  )
}
