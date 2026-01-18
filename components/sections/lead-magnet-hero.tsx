import { Suspense } from 'react'
import Image from 'next/image'
import { Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import LeadMagnetSignupForm from '@/components/sections/lead-magnet-signup-form'
import LeadMagnetCountdown from '@/components/sections/lead-magnet-countdown'

const WHOP_REVIEWS_URL =
  'https://whop.com/price-action-trader-mentorship-24-d9/pat-mentorship-2025/'
const checklistMockupSrc = '/images/lead-magnet/checklist-mockup.png'
const videoThumbnailSrc = '/images/lead-magnet/video-1-thumbnail.jpg'

export default function LeadMagnetHero() {
  return (
    <section className="overflow-hidden bg-white px-5 py-16 sm:px-6 sm:py-24">
      <div className="mx-auto w-full min-w-0 max-w-6xl">
        <div className="grid min-w-0 items-center gap-10 lg:grid-cols-2">
          <div className="min-w-0">
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
            <div className="mt-8 space-y-4">
              <Button
                asChild
                size="lg"
                className="touch-manipulation bg-emerald-600 text-white hover:bg-emerald-700"
              >
                <a href="#lead-magnet-inline-form">
                  3‑Tage‑Plan & Checkliste Jetzt Sichern
                </a>
              </Button>
              <div className="flex flex-wrap items-center gap-3 text-xs text-neutral-500">
                <span>Versand per E‑Mail. Abmeldung jederzeit möglich.</span>
                <a
                  href={WHOP_REVIEWS_URL}
                  className="inline-flex items-center gap-1 text-emerald-700 underline underline-offset-4"
                >
                  <span className="flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map(star => (
                      <Star
                        key={star}
                        className="h-3.5 w-3.5 fill-amber-400 text-amber-400"
                        aria-hidden="true"
                      />
                    ))}
                  </span>
                  <span>5,0/5 • Whop‑Bewertungen</span>
                </a>
              </div>
              <div
                id="lead-magnet-inline-form"
                className="grid min-w-0 gap-4 lg:grid-cols-[1.15fr_0.85fr]"
              >
                <Card className="min-w-0 border-emerald-200 p-5">
                  <p className="text-pretty text-sm font-medium text-neutral-900">
                    Starte Jetzt Kostenlos
                  </p>
                  <p className="text-pretty mt-1 text-xs text-neutral-500">
                    Videos & Trading‑Plan kommen per E‑Mail.
                  </p>
                  <Suspense fallback={null}>
                    <LeadMagnetSignupForm className="mt-4" idPrefix="lead-magnet-inline" />
                  </Suspense>
                </Card>
                <Card className="min-w-0 border-emerald-100 p-4">
                  <p className="text-pretty text-xs font-medium text-neutral-500">
                    PDF‑Checkliste + Trading‑Plan
                  </p>
                  <div className="mt-3 overflow-hidden rounded-lg border border-neutral-200">
                    <Image
                      src={checklistMockupSrc}
                      alt="3D‑Mockup der ICT‑Checkliste und des Trading‑Plans"
                      width={420}
                      height={320}
                      className="h-auto w-full"
                      sizes="(max-width: 1024px) 100vw, 420px"
                    />
                  </div>
                </Card>
              </div>
            </div>
          </div>
          <div className="space-y-4 min-w-0">
            <Card className="border-emerald-100 p-4">
              <p className="text-pretty text-xs font-medium text-neutral-500">
                Video 1 Vorschau
              </p>
              <div className="mt-3 overflow-hidden rounded-lg border border-neutral-200">
                <Image
                  src={videoThumbnailSrc}
                  alt="Thumbnail von Video 1"
                  width={520}
                  height={320}
                  className="h-auto w-full"
                  sizes="(max-width: 1024px) 100vw, 520px"
                />
              </div>
            </Card>
            <Card className="border-emerald-200 p-6 sm:p-8">
              <h2 className="text-balance text-2xl font-semibold text-neutral-950">
                So Sieht Dein Start Aus
              </h2>
              <p className="text-pretty mt-3 text-base text-neutral-600">
                Du erhältst jeden Tag eine klare Aufgabe. Nach drei Tagen hast du
                einen strukturierten Start in ICT und weißt, wie du Setups prüfst.
              </p>
              <div className="mt-6 space-y-4 text-base text-neutral-700">
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
            <div>
              <p className="text-pretty text-xs text-neutral-500">
                Starte jetzt, um pünktlich zum Mentorship‑Start am 01.03.2026
                vorbereitet zu sein.
              </p>
              <LeadMagnetCountdown
                className="mt-3"
                targetDate="2026-03-01T00:00:00+01:00"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
