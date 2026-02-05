'use client'

import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { SignInButton, useUser } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { trackConversion } from '@/components/analytics/google-tag-manager'
import { Countdown } from '@/components/ui/countdown'
import { ChevronDownIcon } from '@/components/ui/chevron-down'

export default function HormoziLanding() {
  const { isSignedIn } = useUser()
  const router = useRouter()
  const handleJoinClick = () => {
    trackConversion.ctaClick()
    if (isSignedIn) {
      router.push('/dashboard')
    }
  }

  const handleSignInClick = () => {
    trackConversion.ctaClick()
    trackConversion.signInStart()
  }

  const ctaButton = isSignedIn ? (
    <Button size="lg" className="h-14 w-full px-8 text-base sm:w-auto sm:text-lg" onClick={handleJoinClick}>
      Prüfen, ob Plätze frei sind
    </Button>
  ) : (
    <SignInButton mode="modal" forceRedirectUrl="/dashboard">
      <Button size="lg" className="h-14 w-full px-8 text-base sm:w-auto sm:text-lg" onClick={handleSignInClick}>
        Prüfen, ob Plätze frei sind
      </Button>
    </SignInButton>
  )

  return (
    <main className="min-h-dvh bg-white text-slate-900">
      {/* HERO */}
      <section>
        <div className="mx-auto flex min-h-dvh max-w-4xl flex-col items-center justify-start gap-9 px-5 pb-10 pt-6 text-center sm:gap-12 sm:pb-14 sm:pt-8">
          <p className="inline-flex w-fit items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold uppercase text-blue-700">
            PAT Mentorship 2026
          </p>
          <h1 className="text-balance text-4xl font-bold leading-tight text-slate-900 sm:text-5xl md:text-6xl">
            Theorie macht dich schlau. <span className="text-blue-700">Praxis macht dich</span>{" "}
            <span className="rounded-sm bg-yellow-200 px-1 text-blue-700">profitabel.</span>
          </h1>
          <p className="text-pretty text-base font-medium leading-relaxed text-slate-700 sm:text-lg">
            Die meisten Kurse enden bei Theorie. Ich fange dort an – wir gehen 2–3x pro Woche live in den Markt. So
            lernst du, was wirklich funktioniert.
          </p>

          <div className="relative mx-auto w-full max-w-3xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="relative aspect-video w-full">
              <Image
                src="/images/hero/Hero-image-v4.png"
                alt="PAT Mentorship Hero"
                fill
                sizes="(min-width: 768px) 768px, 100vw"
                className="object-cover"
                priority
              />
            </div>
          </div>

          <div className="mt-4 flex w-full flex-col items-center gap-3">
            {ctaButton}
            <p className="text-xs text-slate-500">
              150€/Monat · monatlich kündbar ·{" "}
              <span className="rounded-sm bg-yellow-200 px-1 text-blue-700">max. 100 Plätze</span>
            </p>
          </div>
        </div>
      </section>

      <div className="sm:min-h-dvh sm:flex sm:flex-col">
        {/* OBJECTIONS */}
        <section className="bg-slate-50 sm:flex sm:flex-1 sm:items-center">
          <div className="mx-auto max-w-6xl px-5 py-8 sm:py-12">
            <h2 className="text-balance text-2xl font-bold text-slate-900 sm:text-3xl">
              Die drei größten Bedenken – direkt geklärt
            </h2>
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              {[
              {
                  title: 'Funktioniert das wirklich?',
                  copy: (
                    <>
                      Ja. Tausende ICT‑Trader sind damit profitabel. Kyle hat den größten APEX‑Payout mit über 2,5
                      Mio. USD. Er tradet genau diese Konzepte.{' '}
                      <a
                        href="https://x.com/jadecap_/status/1746146552815493564?s=20"
                        target="_blank"
                        rel="noreferrer"
                        className="text-slate-600 underline underline-offset-2 hover:text-slate-700"
                      >
                        Sein Tweet
                      </a>
                      .
                    </>
                  ),
                },
              {
                  title: 'Bist du profitabel oder nur ein Guru?',
                  copy: (
                    <>
                      Ja. Ich habe verifizierte Payouts von FK‑Anbietern.{' '}
                      <a
                        href="https://x.com/Topstep/status/1960336160917479927?s=20"
                        target="_blank"
                        rel="noreferrer"
                        className="text-slate-600 underline underline-offset-2 hover:text-slate-700"
                      >
                        Topstep‑Payout
                      </a>
                      . Ich lehre das seit 2 Jahren. 53 von 53 geben 5 Sterne (
                      <a
                        href="https://whop.com/price-action-trader-mentorship-24-d9/pat-mentorship-2025/"
                        target="_blank"
                        rel="noreferrer"
                        className="text-slate-600 underline underline-offset-2 hover:text-slate-700"
                      >
                        Whop‑Bewertungen
                      </a>
                      ). Meine Trades streame ich live auf YouTube.
                    </>
                  ),
                },
              {
                  title: 'Ist das für Anfänger?',
                  copy:
                    'Ja. Die Mentorship ist für Anfänger gebaut. Wenn du keinen Mehrwert merkst, dann kannst du monatlich kündigen.',
                },
              ].map((item) => (
                <div key={item.title} className="rounded-xl border border-slate-200 bg-white p-5 text-left sm:p-6 lg:p-7">
                  <p className="text-base font-semibold text-blue-700 sm:text-lg lg:text-xl">{item.title}</p>
                  <p className="mt-2 text-sm text-slate-700 lg:text-base">{item.copy}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* SECTION 1 */}
        <section className="sm:bg-slate-50 sm:flex sm:flex-1 sm:items-center">
          <div className="mx-auto max-w-6xl px-5 py-12 sm:py-16">
            <h2 className="text-balance text-2xl font-bold text-slate-900 sm:text-3xl">Das bekommst du jede Woche</h2>
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              {[
              {
                  title: 'Live Trading + Prognosen',
                  copy: '2–3 Sessions pro Woche am echten Chart. Tages- und Wochenausblicke.',
                },
                {
                  title: 'Aufzeichnungen',
                  copy: 'Alles bleibt gespeichert. Du kannst jederzeit nachholen.',
                },
                {
                  title: 'Feedback',
                  copy: 'Du bekommst deine Fragen beantwortet, bis es sitzt.',
                },
              ].map((item) => (
                <div key={item.title} className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 lg:p-7">
                  <p className="text-base font-semibold text-blue-700 sm:text-lg lg:text-xl">{item.title}</p>
                  <p className="mt-2 text-sm text-slate-700 lg:text-base">{item.copy}</p>
                </div>
              ))}
            </div>
          <div className="mt-10 flex justify-center sm:mt-12 sm:pb-6">
            <ChevronDownIcon className="text-slate-900" size={56} autoPlay />
          </div>
          </div>
        </section>
      </div>

      {/* FINAL CTA */}
      <section className="bg-slate-50 sm:bg-white sm:min-h-[50vh]">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-center px-5 py-14 text-center sm:min-h-[50vh] sm:py-20">
          <h2 className="text-balance text-2xl font-bold text-slate-900 sm:text-3xl">
            Hol dir{" "}
            <span className="rounded-sm bg-yellow-200 px-1 text-blue-700">ICT Live‑Coaching</span> + klare Regeln
          </h2>
          <p className="text-pretty mt-4 text-sm text-slate-600 sm:text-base">
            Du bekommst 2–3 Live‑Sessions pro Woche. Du kommst rein, indem du dich anmeldest.
          </p>
          <div className="mt-6 flex justify-center">
            <div className="max-w-sm">
              <p className="text-[11px] text-slate-500">Anmeldung schließt in</p>
              <Countdown
                targetDate="2026-03-01T00:00:00+01:00"
                variant="light"
                className="mt-2 scale-75 sm:scale-90 sm:[&>div]:flex-nowrap"
              />
            </div>
          </div>
          <div className="mt-7 space-y-3">
            {isSignedIn ? (
              <Button
                size="lg"
                className="h-14 w-full bg-blue-600 px-8 text-base text-white hover:bg-blue-700 sm:h-16 sm:w-auto sm:text-lg"
                onClick={handleJoinClick}
              >
                Prüfe, ob noch Plätze frei sind
              </Button>
            ) : (
              <SignInButton mode="modal" forceRedirectUrl="/dashboard">
                <Button
                  size="lg"
                  className="h-14 w-full bg-blue-600 px-8 text-base text-white hover:bg-blue-700 sm:h-16 sm:w-auto sm:text-lg"
                  onClick={handleSignInClick}
                >
                  Prüfe, ob noch Plätze frei sind
                </Button>
              </SignInButton>
            )}
            <p className="text-xs text-slate-500">
              150€/Monat · monatlich kündbar ·{" "}
              <span className="rounded-sm bg-yellow-200 px-1 text-blue-700">max. 100 Plätze</span>
            </p>
          </div>
        </div>
      </section>
    </main>
  )
}
