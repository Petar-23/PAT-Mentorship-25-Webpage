'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from "@/components/ui/button"
import { ArrowRight, Star, Users, Award, LineChart, BadgeCheck } from "lucide-react"
import Link from "next/link"
import { GLSLHills } from "../ui/glsl-hills"
import { Countdown } from "@/components/ui/countdown"
import Image from "next/image"
import { useMediaQuery } from "@/hooks/use-media-query"
import { SignInButton, useUser } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { trackConversion } from '@/components/analytics/google-tag-manager'
import { HeroPill } from '@/components/ui/hero-pill'
import { ParticleTextReveal } from '@/components/ui/particle-text-reveal'

export default function Hero() {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })
  const containerRef = useRef<HTMLDivElement>(null)
  const isMobile = useMediaQuery("(max-width: 768px)")
  const [isNavigating, setIsNavigating] = useState(false)
  const [isInView, setIsInView] = useState(false)
  const { isSignedIn } = useUser()
  const router = useRouter()
  const [whopStats, setWhopStats] = useState<{ count: number; average: number } | null>(null)

  useEffect(() => {
    if (!isMobile && isInView) {
      const handleMouseMove = (e: MouseEvent) => {
        if (containerRef.current) {
          const rect = containerRef.current.getBoundingClientRect()
          setMousePosition({
            x: e.clientX - rect.left,
            y: e.clientY - rect.top + window.scrollY
          })
        }
      }

      window.addEventListener('mousemove', handleMouseMove)
      return () => window.removeEventListener('mousemove', handleMouseMove)
    }
  }, [isMobile, isInView])

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
    let cancelled = false

    async function loadWhopStats() {
      try {
        const res = await fetch('/api/whop/reviews?limit=200&per=50')
        if (!res.ok) return

        const data = (await res.json()) as { reviews?: Array<{ rating: number | null }> }
        const reviews = Array.isArray(data?.reviews) ? data.reviews : []

        const ratingValues = reviews
          .map((r) => (typeof r.rating === 'number' && Number.isFinite(r.rating) ? r.rating : null))
          .filter((x): x is number => x != null)

        const average = ratingValues.length > 0 ? ratingValues.reduce((sum, v) => sum + v, 0) / ratingValues.length : 5

        if (!cancelled) {
          setWhopStats({ count: reviews.length, average })
        }
      } catch {
        // Silent fail
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

  const handleGetStarted = () => {
    // Track CTA Click für Conversion-Optimierung
    trackConversion.ctaClick()
    
    if (isSignedIn) {
      setIsNavigating(true)
      router.push('/dashboard')
      setTimeout(() => setIsNavigating(false), 500)
    }
  }
  
  const handleSignInClick = () => {
    // Track wenn nicht-eingeloggter User auf CTA klickt
    trackConversion.ctaClick()
    trackConversion.signInStart()
  }
  
  const handleScrollToDetails = () => {
    const target = document.getElementById('why-different')
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' })
    } else {
      window.location.hash = 'why-different'
    }
  }

  const handleScrollToMentorTarget = (targetName: string) => {
    const viewport = isMobile ? 'mobile' : 'desktop'
    const selector = `[data-mentor-target="${targetName}"][data-mentor-viewport="${viewport}"]`
    const target = document.querySelector(selector)
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }
    const fallback = document.querySelector(`[data-mentor-target="${targetName}"]`)
    if (fallback) {
      fallback.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  return (
    <section 
      ref={containerRef}
      className="relative pt-6 pb-12 sm:py-24 md:py-20 lg:py-32 min-h-[85vh] lg:min-h-[65vh] overflow-hidden bg-gradient-to-b from-white to-gray-50"
    >
       {/* GLSL Hills Background Layer */}
      {!isMobile && isInView && (
        <GLSLHills
          speed={0.3}
          cameraZ={125}
        />
      )}

      {/* Content */}
      <div className="container mx-auto px-4 relative z-10 h-full">
            <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-start lg:items-center mt-0 lg:mt-8">
            {/* Left Column - Text Content */}
              <div className="space-y-8 order-2 lg:order-1">
              
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
                          <Star key={star} className="h-3 w-3 fill-amber-500 text-amber-500" />
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
                  label="Limitiert auf 100 Plätze • Start am 01.03.2026"
                />
              </div>
              <h1 className="hidden lg:block text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-gray-900 lg:leading-[1.1]">
                Dein{" "}
                {isInView ? (
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
                Du zahlst monatlich und kannst jederzeit kündigen, wenn der Mehrwert nicht passt.
              </p>
              
              <div className="flex flex-col sm:flex-row sm:justify-center lg:justify-start gap-4 pt-2 w-full">
                <div className="w-full sm:w-auto">
                  {isSignedIn ? (
                    <Button
                      size="lg"
                      onClick={handleGetStarted}
                      disabled={isNavigating}
                      className="w-full flex items-center gap-2 justify-center"
                    >
                      Sichere dir deinen Platz
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  ) : (
                    <Button size="lg" className="w-full" onClick={handleScrollToDetails}>
                      Details erkunden
                    </Button>
                  )}
                </div>
                
                <div className="w-full sm:w-auto">
                  {isSignedIn ? (
                    <Button size="lg" variant="outline" className="w-full" onClick={handleScrollToDetails}>
                      Mentorship Details
                    </Button>
                  ) : (
                    <SignInButton mode="modal" forceRedirectUrl="/dashboard">
                      <Button 
                        size="lg" 
                        variant="outline"
                        className="w-full flex items-center gap-2 justify-center"
                        onClick={handleSignInClick}
                      >
                        Jetzt Platz sichern
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </SignInButton>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap justify-center gap-3 pt-4 lg:pt-3 text-center lg:justify-start lg:text-left">
                <div className="min-w-[110px] flex-1 sm:flex-initial">
                  <p className="text-xl lg:text-3xl font-bold text-gray-900">€150</p>
                  <p className="text-xs sm:text-sm text-gray-600">/Monat (inkl. MwSt.)</p>
                </div>
                <div className="min-w-[110px] flex-1 sm:flex-initial">
                  <p className="text-xl lg:text-3xl font-bold text-gray-900">2-3x</p>
                  <p className="text-xs sm:text-sm text-gray-600">Live Calls / Woche</p>
                </div>
                <div className="min-w-[110px] flex-1 sm:flex-initial">
                  <p className="text-xl lg:text-3xl font-bold text-gray-900">100</p>
                  <p className="text-xs sm:text-sm text-gray-600">Limitierte Plätze</p>
                </div>
              </div>

              <div className="pt-3 hidden lg:block text-left">
                
                <div className="inline-flex items-center gap-1.5 sm:gap-2 pl-1.5 sm:pl-2 pr-3 sm:pr-4 py-1 rounded-full bg-blue-50 ring-1 ring-blue-200 mb-3">
                  <div className="bg-blue-100 text-blue-700 rounded-full px-2 py-0.5 text-xs sm:text-sm">⏰</div>
                  <span className="text-xs sm:text-sm font-medium text-blue-700">Verbleibende Zeit zur Einschreibung</span>
                </div>
                <Countdown targetDate="2026-03-01T00:00:00+01:00" />
              </div>
            </div>

            {/* Right Column - Visual Element */}
            <div className="relative flex items-center justify-center lg:-mt-8 order-1 lg:order-2">
              <div className="relative w-full max-w-lg mx-auto">
                <div className="relative overflow-hidden rounded-2xl shadow-xl ring-1 ring-gray-200/60 bg-white aspect-[2/3] sm:aspect-[4/5]">
                  <div className="absolute inset-0 bg-gradient-to-t from-gray-900/75 via-gray-900/35 to-transparent" />
                  <div className="absolute top-4 left-4 right-4 lg:hidden z-10">
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
                              <Star key={`mobile-top-star-${star}`} className="h-3 w-3 fill-amber-500 text-amber-500" />
                            ))}
                          </span>
                        </span>
                      }
                      label={`${whopCount} Bewertungen`}
                    />
                    <h1 className="mt-2 text-[26px] sm:text-3xl font-bold tracking-tight text-gray-900 leading-snug drop-shadow-sm">
                      Dein{" "}
                      <span className="text-blue-600">
                        Live-Mentoring:
                      </span>
                      {" "}ICT verstehen, lernen und anwenden
                    </h1>
                  </div>
                  <Image
                    src="/images/mentor-image-2.png"
                    alt="Mentorship Live Call"
                    fill
                    className="object-cover"
                    sizes="(max-width: 1024px) 90vw, 520px"
                    priority
                  />
                  <div className="absolute bottom-4 left-4 right-4 grid grid-cols-2 gap-1.5 sm:gap-2">
                    <button
                      type="button"
                      onClick={() => handleScrollToMentorTarget('experience')}
                      className="flex items-center gap-1.5 sm:gap-2 rounded-md bg-white px-2 py-2 sm:px-3 sm:py-2.5 text-[10px] sm:text-xs font-semibold text-gray-900 shadow-md hover:bg-gray-50 transition"
                    >
                      <div className="h-5 w-5 sm:h-6 sm:w-6 rounded-md bg-purple-500/15 text-purple-700 flex items-center justify-center shrink-0">
                        <Award className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                      </div>
                      2 Jahre Coaching
                    </button>
                    <button
                      type="button"
                      onClick={() => handleScrollToMentorTarget('mentees')}
                      className="flex items-center gap-1.5 sm:gap-2 rounded-md bg-white px-2 py-2 sm:px-3 sm:py-2.5 text-[10px] sm:text-xs font-semibold text-gray-900 shadow-md hover:bg-gray-50 transition"
                    >
                      <div className="h-5 w-5 sm:h-6 sm:w-6 rounded-md bg-blue-500/15 text-blue-700 flex items-center justify-center shrink-0">
                        <Users className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                      </div>
                      130+ Absolventen
                    </button>
                    <button
                      type="button"
                      onClick={() => handleScrollToMentorTarget('performance')}
                      className="flex items-center gap-1.5 sm:gap-2 rounded-md bg-white px-2 py-2 sm:px-3 sm:py-2.5 text-[10px] sm:text-xs font-semibold text-gray-900 shadow-md hover:bg-gray-50 transition"
                    >
                      <div className="h-5 w-5 sm:h-6 sm:w-6 rounded-md bg-emerald-500/15 text-emerald-700 flex items-center justify-center shrink-0">
                        <LineChart className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                      </div>
                      Performance sichtbar
                    </button>
                    <button
                      type="button"
                      onClick={() => handleScrollToMentorTarget('payout')}
                      className="flex items-center gap-1.5 sm:gap-2 rounded-md bg-white px-2 py-2 sm:px-3 sm:py-2.5 text-[10px] sm:text-xs font-semibold text-gray-900 shadow-md hover:bg-gray-50 transition"
                    >
                      <div className="h-5 w-5 sm:h-6 sm:w-6 rounded-md bg-amber-500/15 text-amber-700 flex items-center justify-center shrink-0">
                        <BadgeCheck className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
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
                    className="w-full justify-center"
                    announcement="🚀"
                    label="Limitiert auf 100 Plätze • Start am 01.03.2026"
                  />
                </div>

                <div className="mt-4 lg:hidden text-center">
                  <p className="text-xs text-gray-700 mb-2">
                    Verbleibende Zeit zur Einschreibung in die Warteliste
                  </p>
                  <Countdown targetDate="2026-03-01T00:00:00+01:00" />
                </div>

                <div className="mt-2 grid sm:grid-cols-2 gap-3 items-stretch">
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
                          <Star key={i} className="h-4 w-4 fill-current" />
                        ))}
                      </div>
                    </div>
                  </a>

                  <div className="hidden lg:block rounded-xl border bg-white p-4 shadow-sm h-full">
                    <div className="flex items-center gap-3">
                      <div className="h-7 w-7 rounded-lg bg-emerald-500/15 text-emerald-700 flex items-center justify-center">
                        <BadgeCheck className="h-4 w-4" />
                      </div>
                      <p className="text-sm font-semibold text-gray-900">Langfristiger Zugang</p>
                    </div>
                    <p className="text-xs text-gray-600 mt-1">
                      Bleib 12 Monate dabei & erhalte dauerhaft Zugriff auf alle Materialien
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