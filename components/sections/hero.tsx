'use client'

import { useState, useEffect, useRef } from 'react'
import dynamic from 'next/dynamic'
import { Button } from "@/components/ui/button"
import { ChartLine as LineChart } from "@phosphor-icons/react/ChartLine"
import { Medal as Award } from "@phosphor-icons/react/Medal"
import { SealCheck as BadgeCheck } from "@phosphor-icons/react/SealCheck"
import { Star } from "@phosphor-icons/react/Star"
import { Users } from "@phosphor-icons/react/Users"
import { Countdown } from "@/components/ui/countdown"
import Image from "next/image"
import { useMediaQuery } from "@/hooks/use-media-query"
import { MentorshipEntryCta } from '@/components/sections/mentorship-entry-cta'
import { HeroPill } from '@/components/ui/hero-pill'
import { MENTORSHIP_CONFIG, MENTORSHIP_IS_UPCOMING } from '@/lib/config'
import { getWhopReviewStats } from '@/lib/whop-review-stats'

const GLSLHills = dynamic(
  () => import('../ui/glsl-hills').then((mod) => mod.GLSLHills),
  { ssr: false }
)

const ParticleTextReveal = dynamic(
  () => import('@/components/ui/particle-text-reveal').then((mod) => mod.ParticleTextReveal),
  {
    ssr: false,
    loading: () => <span className="text-blue-600">Live-Mentoring:</span>,
  }
)

export default function Hero() {
  const containerRef = useRef<HTMLDivElement>(null)
  const isMobile = useMediaQuery("(max-width: 1023px)")
  const [isInView, setIsInView] = useState(false)
  const [showAmbientBackground, setShowAmbientBackground] = useState(false)
  const [whopStats, setWhopStats] = useState<{ count: number; average: number } | null>(null)

  useEffect(() => {
    if (!containerRef.current) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsInView(entry.isIntersecting)
      },
      { threshold: 0.15 }
    )

    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (isMobile || !isInView || showAmbientBackground) return

    const w =
      typeof window !== 'undefined'
        ? (window as Window & {
            requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number
            cancelIdleCallback?: (id: number) => void
          })
        : undefined

    let cleanup: (() => void) | undefined
    if (w?.requestIdleCallback) {
      const id = w.requestIdleCallback(() => setShowAmbientBackground(true), { timeout: 2500 })
      cleanup = () => w.cancelIdleCallback?.(id)
    } else if (typeof window !== 'undefined') {
      const id = window.setTimeout(() => setShowAmbientBackground(true), 1400)
      cleanup = () => window.clearTimeout(id)
    }

    return cleanup
  }, [isMobile, isInView, showAmbientBackground])

  useEffect(() => {
    let cancelled = false

    async function loadWhopStats() {
      const stats = await getWhopReviewStats()
      if (!cancelled && stats) {
        setWhopStats(stats)
      }
    }

    const w =
      typeof window !== 'undefined'
        ? (window as Window & {
            requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number
            cancelIdleCallback?: (id: number) => void
          })
        : undefined

    let cleanup: (() => void) | undefined
    if (w?.requestIdleCallback) {
      const id = w.requestIdleCallback(() => {
        if (!cancelled) {
          void loadWhopStats()
        }
      }, { timeout: 2000 })
      cleanup = () => w.cancelIdleCallback?.(id)
    } else if (typeof window !== 'undefined') {
      const id = window.setTimeout(() => {
        if (!cancelled) {
          void loadWhopStats()
        }
      }, 1200)
      cleanup = () => window.clearTimeout(id)
    }

    return () => {
      cancelled = true
      cleanup?.()
    }
  }, [])

  const whopCount = whopStats?.count ?? 48
  const whopAvg = whopStats?.average ?? 5
  const whopAvgRounded = Math.round(whopAvg * 10) / 10
  const whopAvgText = (whopAvgRounded % 1 === 0 ? whopAvgRounded.toFixed(0) : whopAvgRounded.toFixed(1)).replace(
    '.',
    ','
  )

  const handleScrollToMentorTarget = (targetName: string) => {
    const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
    const viewport = isMobile ? 'mobile' : 'desktop'
    const selector = `[data-mentor-target="${targetName}"][data-mentor-viewport="${viewport}"]`
    const target = document.querySelector(selector)
    if (target) {
      target.scrollIntoView({ behavior, block: 'start' })
      return
    }
    const fallback = document.querySelector(`[data-mentor-target="${targetName}"]`)
    if (fallback) {
      fallback.scrollIntoView({ behavior, block: 'start' })
    }
  }

  return (
    <section 
      ref={containerRef}
      className="relative pt-6 pb-12 sm:py-24 md:py-20 lg:py-32 min-h-[85vh] lg:min-h-[65vh] overflow-hidden bg-gradient-to-b from-white to-gray-50"
    >
       {/* GLSL Hills Background Layer */}
      {!isMobile && showAmbientBackground && (
        <GLSLHills
          speed={0.3}
          cameraZ={125}
        />
      )}

      {/* Content */}
      <div className="container mx-auto px-4 relative z-10 h-full">
            <div className="grid lg:grid-cols-2 gap-7 lg:gap-12 items-start lg:items-center mt-0 lg:mt-8">
            {/* Left Column - Text Content */}
              <div className="space-y-5 order-1 lg:space-y-8">

              <div className="flex flex-wrap items-center gap-2 lg:hidden">
                <HeroPill
                  href="https://whop.com/price-action-trader-mentorship-24-d9/pat-mentorship-2025/"
                  isExternal
                  variant="amber"
                  size="sm"
                  announcement={
                    <span className="flex items-center gap-1">
                      <Image
                        src="/images/whop-logo.png"
                        alt="Whop"
                        width={16}
                        height={16}
                        className="h-4 w-4"
                      />
                      <Star aria-hidden="true" weight="fill" className="h-3 w-3 fill-amber-500 text-amber-500" />
                    </span>
                  }
                  label={`${whopAvgText}/5 · ${whopCount} Reviews`}
                />
                <HeroPill
                  variant="blue"
                  size="sm"
                  className="whitespace-normal py-2 text-center leading-snug"
                  announcement="🚀"
                  label={
                    MENTORSHIP_IS_UPCOMING
                      ? `Start ${MENTORSHIP_CONFIG.startDateFormatted}`
                      : 'Einstieg möglich'
                  }
                />
              </div>
              
              <div className="hidden lg:flex flex-wrap items-center gap-3">
                <HeroPill
                  href="https://whop.com/price-action-trader-mentorship-24-d9/pat-mentorship-2025/"
                  isExternal
                  variant="amber"
                  size="sm"
                  announcement={
                    <span className="flex items-center gap-1.5">
                      <Image
                        src="/images/whop-logo.png"
                        alt="Whop"
                        width={16}
                        height={16}
                        className="h-4 w-4"
                      />
                      <span className="flex items-center gap-0.5">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star aria-hidden="true" key={star} weight="fill" className="h-3 w-3 fill-amber-500 text-amber-500" />
                        ))}
                      </span>
                    </span>
                  }
                  label={`${whopCount} Bewertungen`}
                />

                <HeroPill
                  variant="blue"
                  size="sm"
                  announcement="🚀"
                  label={
                    MENTORSHIP_IS_UPCOMING
                      ? `Start am ${MENTORSHIP_CONFIG.startDateFormatted}`
                      : MENTORSHIP_CONFIG.enrollmentLabel
                  }
                />
              </div>
              <h1 className="text-balance text-[2rem] font-bold leading-[1.08] text-gray-900 lg:hidden">
                ICT verstehen.{' '}
                <span className="text-blue-600">Im Live-Mentoring anwenden.</span>
              </h1>

              <h1 className="hidden lg:block text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-gray-900 lg:leading-[1.1]">
                Dein{" "}
                {!isMobile && isInView ? (
                  <ParticleTextReveal text="Live-Mentoring:" fontSize={58} />
                ) : (
                  <span className="text-blue-600">
                    Live-Mentoring:
                  </span>
                )}
                {" "}ICT verstehen, lernen und anwenden
              </h1>
              
              <p className="hidden lg:block text-lg md:text-xl text-gray-600 leading-relaxed max-w-xl">
                Ich baue dein Verständnis Schritt für Schritt auf: Theorie, danach Live-Tape-Reading und später echtes Live-Trading.
                Du zahlst monatlich und kannst zum Monatsende kündigen, wenn der Mehrwert nicht passt.
              </p>

              <p className="text-pretty text-base leading-relaxed text-gray-600 lg:hidden">
                {MENTORSHIP_CONFIG.sessionsPerWeek} Live-Sessions pro Woche, klare Trading-Modelle und direktes Feedback – für{' '}
                {MENTORSHIP_CONFIG.priceFormatted} im Monat, monatlich kündbar.
              </p>
              
              <div className="pt-1">
                <div className="flex w-full flex-col gap-3 sm:flex-row sm:justify-center lg:justify-start">
                  <div className="w-full sm:w-auto">
                    <MentorshipEntryCta
                      source="hero_cta"
                      className="w-full"
                    />
                  </div>
                  <div className="w-full sm:w-auto">
                    <Button
                      asChild
                      size="lg"
                      variant="outline"
                      className="w-full touch-manipulation"
                    >
                      <a href="#why-different">Programm &amp; Ablauf ansehen</a>
                    </Button>
                  </div>
                </div>
                <p className="mt-3 text-center text-xs leading-relaxed text-gray-500 sm:text-sm lg:text-left">
                  Kostenlos anmelden → Konditionen prüfen → sicher über Stripe buchen
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-2 text-center lg:flex lg:flex-wrap lg:justify-start lg:gap-6 lg:pt-3 lg:text-left">
                <div>
                  <p className="text-xl lg:text-3xl font-bold text-gray-900">{MENTORSHIP_CONFIG.priceFormatted}</p>
                  <p className="text-xs sm:text-sm text-gray-600">/Monat (inkl. MwSt.)</p>
                </div>
                <div>
                  <p className="text-xl lg:text-3xl font-bold text-gray-900">{MENTORSHIP_CONFIG.sessionsPerWeek}×</p>
                  <p className="text-xs sm:text-sm text-gray-600">Live Calls / Woche</p>
                </div>
                <div>
                  <p className="text-xl lg:text-3xl font-bold text-gray-900">Flexibel</p>
                  <p className="text-xs sm:text-sm text-gray-600">monatlich kündbar</p>
                </div>
              </div>

              {MENTORSHIP_IS_UPCOMING ? (
                <div className="pt-3 hidden lg:block text-left">
                  <div className="inline-flex items-center gap-1.5 sm:gap-2 pl-1.5 sm:pl-2 pr-3 sm:pr-4 py-1 rounded-full bg-blue-50 ring-1 ring-blue-200 mb-3">
                    <div className="bg-blue-100 text-blue-700 rounded-full px-2 py-0.5 text-xs sm:text-sm">⏰</div>
                    <span className="text-xs sm:text-sm font-medium text-blue-700">Verbleibende Zeit zur Einschreibung</span>
                  </div>
                  <Countdown targetDate={MENTORSHIP_CONFIG.startDate} />
                </div>
              ) : null}
            </div>

            {/* Right Column - Visual Element */}
            <div className="relative flex items-center justify-center order-2 lg:-mt-8">
              <div className="relative w-full max-w-lg mx-auto">
                <div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-gray-200/60">
                  <Image
                    src="/images/mentor-image-2.png"
                    alt="Mentorship Live Call"
                    fill
                    className="object-cover"
                    sizes="(max-width: 1024px) 90vw, 520px"
                    priority
                  />
                  <div className="absolute inset-0 z-[1] bg-gradient-to-t from-gray-900/75 via-gray-900/20 to-transparent" />
                  <div className="absolute bottom-4 left-4 right-4 z-10 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handleScrollToMentorTarget('experience')}
                      className="flex min-h-11 touch-manipulation items-center gap-2 rounded-md bg-white px-2 py-2 text-left text-xs font-semibold text-gray-900 shadow-md transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 sm:px-3 sm:py-2.5"
                    >
                      <div className="h-5 w-5 sm:h-6 sm:w-6 rounded-md bg-purple-500/15 text-purple-700 flex items-center justify-center shrink-0">
                        <Award aria-hidden="true" className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                      </div>
                      2 Jahre Coaching
                    </button>
                    <button
                      type="button"
                      onClick={() => handleScrollToMentorTarget('mentees')}
                      className="flex min-h-11 touch-manipulation items-center gap-2 rounded-md bg-white px-2 py-2 text-left text-xs font-semibold text-gray-900 shadow-md transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 sm:px-3 sm:py-2.5"
                    >
                      <div className="h-5 w-5 sm:h-6 sm:w-6 rounded-md bg-blue-500/15 text-blue-700 flex items-center justify-center shrink-0">
                        <Users aria-hidden="true" className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                      </div>
                      130+ Absolventen
                    </button>
                    <button
                      type="button"
                      onClick={() => handleScrollToMentorTarget('performance')}
                      className="flex min-h-11 touch-manipulation items-center gap-2 rounded-md bg-white px-2 py-2 text-left text-xs font-semibold text-gray-900 shadow-md transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 sm:px-3 sm:py-2.5"
                    >
                      <div className="h-5 w-5 sm:h-6 sm:w-6 rounded-md bg-emerald-500/15 text-emerald-700 flex items-center justify-center shrink-0">
                        <LineChart aria-hidden="true" className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                      </div>
                      Performance sichtbar
                    </button>
                    <button
                      type="button"
                      onClick={() => handleScrollToMentorTarget('payout')}
                      className="flex min-h-11 touch-manipulation items-center gap-2 rounded-md bg-white px-2 py-2 text-left text-xs font-semibold text-gray-900 shadow-md transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 sm:px-3 sm:py-2.5"
                    >
                      <div className="h-5 w-5 sm:h-6 sm:w-6 rounded-md bg-amber-500/15 text-amber-700 flex items-center justify-center shrink-0">
                        <BadgeCheck aria-hidden="true" className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                      </div>
                      Payout‑Nachweis
                    </button>
                  </div>
                </div>

                {/* Limitiert Hero Pill - Mobile only, under the image */}
                <div className="mt-3 lg:hidden">
                  <HeroPill
                    variant="blue"
                    size="sm"
                    className="w-full justify-center whitespace-normal py-2 text-center leading-snug"
                    announcement="🚀"
                    label={
                      MENTORSHIP_IS_UPCOMING
                        ? `Start am ${MENTORSHIP_CONFIG.startDateFormatted}`
                        : MENTORSHIP_CONFIG.enrollmentLabel
                    }
                  />
                </div>

                {MENTORSHIP_IS_UPCOMING ? (
                  <div className="mt-4 lg:hidden text-center">
                    <p className="text-xs text-gray-700 mb-2">
                      Verbleibende Zeit zur Einschreibung in die Warteliste
                    </p>
                    <Countdown targetDate={MENTORSHIP_CONFIG.startDate} />
                  </div>
                ) : null}

                <div className="mt-2 flex flex-col items-center lg:grid lg:grid-cols-2 gap-3 lg:items-stretch">
                  <a
                    href="https://whop.com/price-action-trader-mentorship-24-d9/pat-mentorship-2025/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hidden sm:block h-full"
                  >
                    <div className="rounded-xl border bg-white p-4 shadow-sm hover:bg-gray-50 transition-colors h-full">
                      <div className="flex items-center gap-3">
                        <Image
                          src="/images/whop-logo.png"
                          alt="Whop"
                          width={28}
                          height={28}
                          className="h-7 w-7"
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-900">Whop Reviews</p>
                          <p className="text-xs text-gray-600 tabular-nums truncate">
                            {whopAvgText} von 5 Sterne ({whopCount} Bewertungen)
                          </p>
                        </div>
                      </div>
                      <div className="mt-2 flex items-center gap-1 text-amber-500">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star aria-hidden="true" key={i} weight="fill" className="h-4 w-4 fill-current" />
                        ))}
                      </div>
                    </div>
                  </a>

                  <div className="hidden lg:block rounded-xl border bg-white p-4 shadow-sm h-full">
                    <div className="flex items-center gap-3">
                      <div className="h-7 w-7 rounded-lg bg-emerald-500/15 text-emerald-700 flex items-center justify-center">
                        <BadgeCheck aria-hidden="true" className="h-4 w-4" />
                      </div>
                      <p className="text-sm font-semibold text-gray-900">Aufzeichnungen inklusive</p>
                    </div>
                    <p className="text-xs text-gray-600 mt-1">
                      Greife während deiner Mitgliedschaft auf Materialien und Aufzeichnungen zu
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
      </div>
    </section>
  )
}
