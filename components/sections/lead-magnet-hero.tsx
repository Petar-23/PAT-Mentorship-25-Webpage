import { Suspense } from 'react'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import LeadMagnetSignupForm from '@/components/sections/lead-magnet-signup-form'
import styles from '@/components/sections/lead-magnet-cover.module.css'

const coverMockupSrc = '/images/lead-magnet/ICT%20QUICK-START.png'
const videoThumbnailSrc = '/images/lead-magnet/Video_01_Thumb_02.png'

export default function LeadMagnetHero() {
  return (
    <section className="overflow-hidden bg-white px-5 py-10 sm:px-6 sm:py-20">
      <div className="mx-auto w-full min-w-0 max-w-6xl">
        <div className="lg:hidden">
          <p className="text-pretty text-sm font-medium text-blue-700">
            Kostenloser 3‑Tage‑Quick‑Start
          </p>
          <h1 className="text-balance mt-4 text-3xl font-semibold text-neutral-950">
            Dein ICT Modell 22 Quick‑Start: In 3 Tagen zur Trading‑Checkliste
          </h1>
          <ul className="mt-6 space-y-2 text-pretty text-sm text-neutral-700">
            <li>• Video 1: Die 3 wichtigsten ICT‑Konzepte (Keine 700 Videos!)</li>
            <li>• Video 2: Das ICT Modell 22 Setup und die FVG‑Einstiegstechnik</li>
            <li>• Video 3: Dein fertiger Trading‑Plan + Modell 22 Checkliste (PDF)</li>
          </ul>
          <div className="mt-6 space-y-4">
            <Card className="border-blue-100 p-4">
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
            </Card>
            <Card className="min-w-0 border-transparent p-4 shadow-none">
              <p className="text-pretty text-xs font-medium text-neutral-500">
                Bonus (PDF):
              </p>
              <div className="mt-3 flex items-center justify-center">
                <div
                  className={styles.book}
                  style={{ ['--cover-url' as string]: `url("${coverMockupSrc}")` }}
                >
                  <div className={styles.cover} />
                </div>
              </div>
            </Card>
            <Card className="border-blue-200 p-6">
              <h2 className="text-balance text-xl font-semibold text-neutral-950">
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
            </Card>
            <div id="lead-magnet-inline-form">
              <Card className="min-w-0 border-blue-200 p-5">
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
              <div className="mt-3 text-xs text-neutral-500">
                Versand per E‑Mail. Abmeldung jederzeit möglich.
              </div>
            </div>
          </div>
        </div>
        <div className="hidden lg:grid min-w-0 gap-8 lg:grid-cols-2">
          <div className="min-w-0">
            <p className="text-pretty text-sm font-medium text-blue-700">
              Kostenloser 3‑Tage‑Quick‑Start
            </p>
            <h1 className="text-balance mt-4 text-4xl font-semibold text-neutral-950 sm:text-5xl">
              Dein ICT Modell 22 Quick‑Start: In 3 Tagen zur Trading‑Checkliste
            </h1>
            <p className="text-pretty mt-4 text-lg text-neutral-700">
              Vergiss die 700+ ICT‑Videos. Wir bringen dich in 3 Tagen direkt zum
              ICT Modell 22 – dem einfachen Trading‑Setup, das du sofort anwenden
              kannst. Keine unnötige Theorie, nur das, was zählt: Modell,
              Trading‑Plan und Checkliste.
            </p>
            <ul className="mt-6 space-y-2 text-pretty text-sm text-neutral-700">
              <li>• Video 1: Die 3 wichtigsten ICT‑Konzepte (Keine 700 Videos!)</li>
              <li>• Video 2: Das ICT Modell 22 Setup und die FVG‑Einstiegstechnik</li>
              <li>• Video 3: Dein fertiger Trading‑Plan + Modell 22 Checkliste (PDF)</li>
            </ul>
            <div className="mt-8 flex flex-wrap items-center gap-3 text-xs text-neutral-500">
              <span>Versand per E‑Mail. Abmeldung jederzeit möglich.</span>
            </div>
            <div className="mt-8 grid gap-4 lg:grid-cols-[1fr_auto]" id="lead-magnet-inline-form">
              <Card className="min-w-0 border-blue-200 p-5">
                <p className="text-pretty text-sm font-medium text-neutral-900">
                  Starte Jetzt Kostenlos
                </p>
                <p className="text-pretty mt-1 text-xs text-neutral-500">
                  Videos & Trading‑Plan kommen per E‑Mail.
                </p>
                <Suspense fallback={null}>
                  <LeadMagnetSignupForm className="mt-4" idPrefix="lead-magnet-inline" />
                </Suspense>
                <div className="mt-3 text-xs text-neutral-500">
                  Versand per E‑Mail. Abmeldung jederzeit möglich.
                </div>
              </Card>
              <Card className="min-w-0 border-transparent p-4 shadow-none">
                <p className="text-pretty text-xs font-medium text-neutral-500">
                  Bonus (PDF):
                </p>
                <div className="mt-3 flex items-center justify-center">
                  <div
                    className={styles.book}
                    style={{ ['--cover-url' as string]: `url("${coverMockupSrc}")` }}
                  >
                    <div className={styles.cover} />
                  </div>
                </div>
              </Card>
            </div>
          </div>
          <div className="space-y-4 min-w-0">
            <Card className="border-blue-100 p-4">
              <div className="overflow-hidden rounded-xl border-4 border-blue-200">
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
            <Card className="border-blue-200 p-6 sm:p-8">
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
          </div>
        </div>
      </div>
    </section>
  )
}
