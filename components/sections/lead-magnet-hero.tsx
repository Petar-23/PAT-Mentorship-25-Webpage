import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

export default function LeadMagnetHero() {
  return (
    <section className="bg-white px-3 py-16 sm:px-6 sm:py-24">
      <div className="mx-auto w-full max-w-6xl">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div>
            <p className="text-pretty text-sm font-medium text-emerald-700">
              Kostenloser 3‑Tage‑Quick‑Start
            </p>
            <h1 className="text-balance mt-4 text-4xl font-semibold text-neutral-950 sm:text-5xl">
              Dein ICT Quick‑Start in 3 Tagen
            </h1>
            <p className="text-pretty mt-4 text-lg text-neutral-700">
              Du bekommst einen klaren Einstieg in ICT nach Michael J. Huddleston
              (Smart Money Concepts). Es gibt über 700 ICT‑Videos, deshalb starten
              wir fokussiert mit den Grundlagen. Die Videos kommen exklusiv per
              E‑Mail, damit du Schritt für Schritt vorgehst und nichts überspringst.
            </p>
            <ul className="mt-6 space-y-2 text-pretty text-sm text-neutral-700">
              <li>• Video 1: ICT‑Grundlagen & Orientierung</li>
              <li>• Video 2: Modell 22 mit Einstiegstechnik FVG</li>
              <li>• Video 3: Zeit‑ & Checkliste + Trading‑Plan (PDF)</li>
            </ul>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button
                asChild
                size="lg"
                className="touch-manipulation bg-emerald-600 text-white hover:bg-emerald-700"
              >
                <a href="#lead-magnet-form">Kostenlosen Quick‑Start Sichern</a>
              </Button>
              <p className="text-pretty text-xs text-neutral-500">
                Versand per E‑Mail. Abmeldung jederzeit möglich.
              </p>
            </div>
          </div>
          <Card className="border-emerald-200 p-6 sm:p-8">
            <h2 className="text-balance text-2xl font-semibold text-neutral-950">
              So Sieht Dein Start Aus
            </h2>
            <p className="text-pretty mt-3 text-sm text-neutral-600">
              Du erhältst jeden Tag eine klare Aufgabe. Nach drei Tagen hast du
              einen strukturierten Start in ICT und weißt, wie du Setups prüfst.
            </p>
            <div className="mt-6 space-y-4 text-sm text-neutral-700">
              <div className="rounded-lg border border-neutral-200 p-4">
                <p className="text-pretty font-medium">Tag 1 – Video 1</p>
                <p className="text-pretty text-neutral-600">
                  ICT‑Grundlagen und ein klarer Startpunkt.
                </p>
              </div>
              <div className="rounded-lg border border-neutral-200 p-4">
                <p className="text-pretty font-medium">Tag 2 – Video 2</p>
                <p className="text-pretty text-neutral-600">
                  Modell 22 mit Einstiegstechnik FVG.
                </p>
              </div>
              <div className="rounded-lg border border-neutral-200 p-4">
                <p className="text-pretty font-medium">Tag 3 – Video 3 + PDF</p>
                <p className="text-pretty text-neutral-600">
                  Zeit‑ & Checkliste plus Trading‑Plan.
                </p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </section>
  )
}
