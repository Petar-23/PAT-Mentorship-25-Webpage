import Link from 'next/link'
import { Card } from '@/components/ui/card'
import LeadMagnetSignupForm from '@/components/sections/lead-magnet-signup-form'

export default function LeadMagnetForm() {
  return (
    <section
      id="lead-magnet-form"
      className="scroll-mt-24 overflow-hidden bg-neutral-950 px-5 py-16 text-neutral-50 sm:px-6 sm:py-24"
    >
      <div className="mx-auto w-full max-w-4xl min-w-0">
        <div className="grid min-w-0 gap-8 lg:grid-cols-[1.2fr_1fr]">
          <div className="min-w-0">
            <p className="text-pretty text-sm font-medium text-neutral-300">
              Starte Heute Kostenlos
            </p>
            <h2 className="text-balance mt-4 text-3xl font-semibold text-white sm:text-4xl">
              Hol Dir Video 1, Checkliste & Trading‑Plan
            </h2>
            <p className="text-pretty mt-4 text-base text-neutral-200 sm:text-lg">
              Du bekommst Video 1 sofort per E‑Mail. Video 2 und 3 folgen an den
              nächsten Tagen. Alles ist bewusst kompakt, damit du die Grundlagen
              sauber aufbaust.
            </p>
            <ul className="mt-6 space-y-2 text-pretty text-sm text-neutral-200">
              <li>• 3 klare Videos statt 700+ Chaos</li>
              <li>• PDF‑Checkliste plus Trading‑Plan</li>
              <li>• Einfache Abmeldung mit einem Klick</li>
            </ul>
          </div>
          <Card className="min-w-0 w-full border-emerald-200 p-6 sm:p-8">
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
          </Card>
        </div>
      </div>
    </section>
  )
}
