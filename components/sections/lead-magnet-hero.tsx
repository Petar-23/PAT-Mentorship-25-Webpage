import { Suspense } from 'react'
import Image from 'next/image'
import { GlassCard } from '@/components/ui/glass-card'
import { HeroPill } from '@/components/ui/hero-pill'
import LeadMagnetSignupForm from '@/components/sections/lead-magnet-signup-form'
import { LeadMagnetWhopPill } from '@/components/sections/lead-magnet-whop-pill'
import { AuroraBackground } from '@/components/ui/aurora-background'

const videoThumbnailSrc = '/images/lead-magnet/thumbnail_002.png'

export default function LeadMagnetHero() {
  return (
    <AuroraBackground className="h-auto min-h-0 overflow-hidden bg-white px-5 py-10 sm:px-6 sm:py-20">
      <div className="mx-auto w-full min-w-0 max-w-6xl">
        <div className="lg:hidden">
          <div className="w-fit">
            <HeroPill 
              announcement="🚀" 
              label="Kostenloser 3‑Tage‑Quick‑Start" 
            />
          </div>
          <h1 className="text-balance mt-4 text-3xl font-semibold text-neutral-950">
            Dein ICT Modell 22 Quick‑Start: In 3 Tagen zur Trading‑Checkliste
          </h1>
          <div className="mt-6 space-y-4">
            <GlassCard>
              <div className="overflow-hidden rounded-xl border-4 border-blue-200">
                <Image
                  src={videoThumbnailSrc}
                  alt="Thumbnail von Video 1"
                  width={520}
                  height={320}
                  className="h-auto w-full"
                  sizes="100vw"
                />
              </div>
              <h2 className="text-balance text-xl font-semibold text-neutral-950 mt-6">
                So Sieht Dein Start Aus
              </h2>
              <div className="mt-4 space-y-3 text-sm text-neutral-700">
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
            </GlassCard>
            <div id="lead-magnet-inline-form-mobile">
              <GlassCard>
                <p className="text-pretty text-sm font-medium text-neutral-900">
                  Starte Jetzt Kostenlos
                </p>
                <p className="text-pretty mt-1 text-xs text-neutral-500">
                  Videos & Trading‑Plan kommen per E‑Mail.
                </p>
                <Suspense fallback={null}>
                  <LeadMagnetSignupForm
                    className="mt-4"
                    idPrefix="lead-magnet-inline-mobile"
                    socialProof={<LeadMagnetWhopPill />}
                  />
                </Suspense>
              </GlassCard>
            </div>
          </div>
        </div>
        <div className="hidden lg:grid min-w-0 gap-16 lg:grid-cols-2">
          <div className="min-w-0 flex flex-col justify-between">
            <div className="w-fit">
              <HeroPill 
                announcement="🚀" 
                label="Kostenloser 3‑Tage‑Quick‑Start" 
              />
            </div>
            <h1 className="text-balance mt-4 text-4xl font-semibold text-neutral-950 sm:text-5xl">
              Dein ICT Modell 22 Quick‑Start: In 3 Tagen zur Trading‑Checkliste
            </h1>
            <p className="text-pretty mt-4 text-lg text-neutral-700">
              Vergiss die 700+ ICT‑Videos. Ich bringe dich in 3 Tagen direkt zum
              ICT Modell 22 – dem einfachen Trading‑Setup, das du sofort anwenden
              kannst. Keine unnötige Theorie, nur das, was zählt: Modell,
              Trading‑Plan und Checkliste.
            </p>
            <div className="mt-8 max-w-sm" id="lead-magnet-inline-form-desktop">
              <GlassCard>
                <p className="text-pretty text-sm font-medium text-neutral-900">
                  Starte Jetzt Kostenlos
                </p>
                <p className="text-pretty mt-1 text-xs text-neutral-500">
                  Videos & Trading‑Plan kommen per E‑Mail.
                </p>
                <Suspense fallback={null}>
                  <LeadMagnetSignupForm
                    className="mt-4"
                    idPrefix="lead-magnet-inline-desktop"
                    socialProof={<LeadMagnetWhopPill />}
                  />
                </Suspense>
              </GlassCard>
            </div>
          </div>
          <div className="min-w-0">
            <GlassCard>
              <div className="overflow-hidden rounded-xl border-4 border-blue-200">
                <Image
                  src={videoThumbnailSrc}
                  alt="Thumbnail von Video 1"
                  width={520}
                  height={320}
                  className="h-auto w-full"
                  loading="eager"
                  sizes="(max-width: 1024px) 100vw, 520px"
                />
              </div>
              <h2 className="text-balance text-2xl font-semibold text-neutral-950 mt-6">
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
            </GlassCard>
          </div>
        </div>
      </div>
    </AuroraBackground>
  )
}
