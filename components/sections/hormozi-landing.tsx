'use client'

import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { SignInButton, useUser } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { trackConversion } from '@/components/analytics/google-tag-manager'

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
    <Button size="lg" className="w-full sm:w-auto" onClick={handleJoinClick}>
      Prüfen, ob Plätze frei sind
    </Button>
  ) : (
    <SignInButton mode="modal" forceRedirectUrl="/dashboard">
      <Button size="lg" className="w-full sm:w-auto" onClick={handleSignInClick}>
        Prüfen, ob Plätze frei sind
      </Button>
    </SignInButton>
  )

  return (
    <main className="min-h-screen bg-white text-slate-900">
      {/* HERO */}
      <section className="border-b border-slate-200">
        <div className="mx-auto flex max-w-5xl flex-col gap-8 px-5 py-10 sm:py-14">
          <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
            <div className="space-y-6">
              <p className="inline-flex w-fit items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
                PAT Mentorship 2026
              </p>
              <h1 className="text-3xl font-bold leading-tight text-slate-900 sm:text-4xl md:text-5xl">
                Theorie macht dich schlau. Praxis macht dich profitabel.
              </h1>
              <p className="text-base leading-relaxed text-slate-700 sm:text-lg">
                Die meisten Kurse enden bei Theorie. Ich fange dort an – und wir gehen dann 2–3x pro Woche live in
                den Markt. So lernst du, was wirklich funktioniert.
              </p>
              <div className="space-y-3">
                {ctaButton}
                <p className="text-xs text-slate-500">
                  150€/Monat · monatlich kündbar · max. 100 Plätze
                </p>
              </div>
            </div>

            <div className="relative mx-auto w-full max-w-sm overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900/35 via-slate-900/15 to-transparent" />
              <Image
                src="/images/mentor-image-2.png"
                alt="PAT Mentorship Live Session"
                width={520}
                height={680}
                className="h-full w-full object-cover"
                priority
              />
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 1 */}
      <section className="border-b border-slate-200">
        <div className="mx-auto max-w-5xl px-5 py-12 sm:py-16">
          <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">Das bekommst du jede Woche</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {[
              'Theorie, die du verstehst',
              'Live‑Praxis am echten Chart',
              'Feedback, bis es sitzt',
            ].map((item) => (
              <div key={item} className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm font-medium text-slate-800">
                {item}
              </div>
            ))}
          </div>
          <div className="mt-6 space-y-1 text-sm text-slate-600">
            <p>2–3 Live‑Sessions pro Woche. Aufzeichnungen inklusive.</p>
            <p>Wochen‑ und Tagesausblicke.</p>
            <p>Q&A Deep‑Dives zum Monatsabschluss.</p>
          </div>
        </div>
      </section>

      {/* SECTION 2 */}
      <section className="border-b border-slate-200 bg-slate-50">
        <div className="mx-auto max-w-5xl px-5 py-12 sm:py-16">
          <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">Warum das hier anders ist</h2>
          <p className="mt-4 text-base text-slate-700 sm:text-lg">
            Andere Kurse erklären dir Konzepte. Ich zeige dir, wie sie im Markt wirken. Du lernst zuerst die Logik –
            dann siehst du sie live.
          </p>
        </div>
      </section>

      {/* SECTION 3 */}
      <section className="border-b border-slate-200">
        <div className="mx-auto max-w-5xl px-5 py-12 sm:py-16">
          <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">Für wen ist die PAT M26?</h2>
          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <p className="text-sm font-semibold text-slate-900">Für dich, wenn</p>
              <ul className="mt-3 space-y-2 text-sm text-slate-700">
                <li>du Trading ernst lernen willst</li>
                <li>du klare Regeln brauchst</li>
                <li>du bereit bist zu üben</li>
              </ul>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <p className="text-sm font-semibold text-slate-900">Nicht für dich, wenn</p>
              <ul className="mt-3 space-y-2 text-sm text-slate-700">
                <li>du „schnell reich“ willst</li>
                <li>du nur Signale kopieren willst</li>
                <li>du weniger als 5 Std. / Woche Zeit hast</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 4 */}
      <section className="border-b border-slate-200 bg-slate-50">
        <div className="mx-auto max-w-5xl px-5 py-12 sm:py-16">
          <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">Klarer Preis. Kein Risiko.</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {['150€/Monat', 'Monatlich kündbar', 'Nur 100 Plätze'].map((item) => (
              <div key={item} className="rounded-xl border border-slate-200 bg-white p-4 text-center text-sm font-semibold text-slate-900">
                {item}
              </div>
            ))}
          </div>
          <p className="mt-4 text-sm text-slate-600">Wenn es dir nicht hilft, gehst du einfach.</p>
        </div>
      </section>

      {/* SECTION 5 */}
      <section className="border-b border-slate-200">
        <div className="mx-auto max-w-5xl px-5 py-12 sm:py-16">
          <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">Echte Stimmen</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {[
              'Mehr gelernt in 8 Wochen als in 2 Jahren YouTube. – Marco',
              'Kein Hype. Klare Struktur. Endlich Fortschritt. – Sarah',
            ].map((quote) => (
              <div key={quote} className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                {quote}
              </div>
            ))}
          </div>
          <p className="mt-4 text-sm text-slate-600">Whop Bewertung: 5/5 Sterne (53 Mentees)</p>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="bg-slate-900">
        <div className="mx-auto max-w-5xl px-5 py-12 sm:py-16">
          <h2 className="text-2xl font-bold text-white sm:text-3xl">Willst du Theorie verstehen oder endlich umsetzen?</h2>
          <div className="mt-6 space-y-3">
            {isSignedIn ? (
              <Button size="lg" className="w-full sm:w-auto bg-white text-slate-900 hover:bg-white/90" onClick={handleJoinClick}>
                Platz sichern (150€/Monat)
              </Button>
            ) : (
              <SignInButton mode="modal" forceRedirectUrl="/dashboard">
                <Button size="lg" className="w-full sm:w-auto bg-white text-slate-900 hover:bg-white/90" onClick={handleSignInClick}>
                  Platz sichern (150€/Monat)
                </Button>
              </SignInButton>
            )}
            <p className="text-xs text-slate-300">monatlich kündbar</p>
          </div>
        </div>
      </section>
    </main>
  )
}
