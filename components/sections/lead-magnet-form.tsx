import Link from 'next/link'
import LeadMagnetSignupForm from '@/components/sections/lead-magnet-signup-form'
import { HeroPill } from '@/components/ui/hero-pill'
import { GlassCard } from '@/components/ui/glass-card'

export default function LeadMagnetForm() {
  return (
    <section 
      id="lead-magnet-form"
      className="scroll-mt-24 px-5 py-16 sm:px-6 sm:py-24"
    >
      <div className="mx-auto max-w-5xl">
        <div className="grid gap-8 md:grid-cols-2 md:gap-12">
          <div>
            <div className="w-fit">
              <HeroPill 
                announcement="🎯" 
                label="Starte Heute Kostenlos" 
              />
            </div>
            <h2 className="text-balance mt-4 text-3xl font-semibold text-neutral-950 md:text-4xl">
              Hol Dir Video 1, Checkliste & Trading‑Plan
            </h2>
            <p className="text-pretty mt-4 text-base text-neutral-700 sm:text-lg">
              Du bekommst Video 1 sofort per E‑Mail. Video 2 und 3 folgen an den
              nächsten Tagen.
            </p>
            <ul className="mt-6 space-y-2 text-pretty text-sm text-neutral-700">
              <li>• 3 klare Videos statt 700+ Chaos</li>
              <li>• PDF‑Checkliste plus Trading‑Plan</li>
              <li>• Einfache Abmeldung mit einem Klick</li>
            </ul>
          </div>
          <div>
            <GlassCard className="w-full">
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
      </div>
    </section>
  )
}
