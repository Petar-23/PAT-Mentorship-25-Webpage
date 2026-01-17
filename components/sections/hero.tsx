'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from "@/components/ui/button"
import { ArrowRight, Star, Users, Award, LineChart, BadgeCheck } from "lucide-react"
import Link from "next/link"
import { MatrixRain } from "../ui/matrix-rain"
import Image from "next/image"
import { useMediaQuery } from "@/hooks/use-media-query"
import { SignInButton, useUser } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { trackConversion } from '@/components/analytics/google-tag-manager'

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

  return (
    <section 
      ref={containerRef}
      className="relative pt-6 pb-12 sm:py-24 md:py-20 lg:py-32 min-h-[85vh] lg:min-h-[65vh] overflow-hidden bg-gradient-to-b from-white to-gray-50"
    >
       {/* Matrix Background Layer */}
       {isMobile ? (
        // Mobile version with static background for better performance
        <div className="absolute inset-0">
          <div
            className="absolute inset-0"
            style={{
              background: `radial-gradient(
                circle 150vw at 50% 50%,
                rgba(255, 255, 255, 0.7) 0%,
                rgba(255, 255, 255, 0.92) 45%,
                rgba(255, 255, 255, 1) 100%
              )`,
            }}
          />
        </div>
       ) : (
        // Desktop version with mouse follow
        <div 
          className="absolute inset-0"
          style={{
            mask: `radial-gradient(circle 300px at ${mousePosition.x}px ${mousePosition.y}px, white, transparent)`,
            WebkitMask: `radial-gradient(circle 300px at ${mousePosition.x}px ${mousePosition.y}px, white, transparent)`,
          }}
        >
          {isInView && <MatrixRain color="rgba(128, 128, 128, 0.3)" />}
        </div>
       )}

      {/* Content */}
      <div className="container mx-auto px-4 relative z-10 h-full">
            <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-start lg:items-center mt-0 lg:mt-8">
            {/* Left Column - Text Content */}
              <div className="space-y-8 order-2 lg:order-1">
              
              <div className="hidden lg:flex flex-wrap items-center gap-3">
                <a
                  href="https://whop.com/price-action-trader-mentorship-24-d9/pat-mentorship-2025/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2.5 text-sm font-semibold text-amber-950 transition-colors bg-amber-50/80 backdrop-blur-sm px-3.5 py-1.5 rounded-full border border-amber-200/70 shadow-sm hover:border-amber-300 hover:bg-amber-50"
                >
                  <Image
                    src="/images/whop-logo.png"
                    alt="Whop"
                    width={18}
                    height={18}
                    className="h-4.5 w-4.5"
                  />
                  <div className="flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star key={star} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                  <span className="text-amber-900/80 text-xs">
                    <span className="font-bold text-amber-950">{whopAvgText}</span>/5 • {whopCount} Bewertungen
                  </span>
                </a>

                <div className="inline-block">
                  <span className="inline-flex items-center rounded-full px-4 py-1 text-sm font-medium bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-700/10">
                    Limitiert auf 100 Plätze • Start am 01.03.2026
                  </span>
                </div>
              </div>
              <h1 className="hidden lg:block text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-gray-900 lg:leading-[1.1]">
                Dein{" "}
                <span className="bg-gradient-to-b from-purple-400 to-blue-500 bg-clip-text text-transparent">
                  Live-Mentoring
                </span>
                : ICT verstehen, lernen und anwenden
              </h1>
              
              <p className="hidden lg:block text-lg md:text-xl text-gray-600 leading-relaxed max-w-xl">
                Ich baue dein Verständnis Schritt für Schritt auf: Theorie, danach Live-Tape-Reading und später echtes Live-Trading.
                Du zahlst monatlich und kannst jederzeit kündigen, wenn der Mehrwert nicht passt.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 pt-2 w-full">
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

              <div className="grid grid-cols-3 gap-4 sm:gap-8 pt-4 lg:pt-6">
                <div>
                  <p className="text-2xl lg:text-3xl font-bold text-gray-900">€150</p>
                  <p className="text-sm text-gray-600">/Monat (inkl. MwSt.)</p>
                </div>
                <div>
                  <p className="text-2xl lg:text-3xl font-bold text-gray-900">2-3x</p>
                  <p className="text-sm text-gray-600">Live Calls / Woche</p>
                </div>
                <div>
                  <p className="text-2xl lg:text-3xl font-bold text-gray-900">100</p>
                  <p className="text-sm text-gray-600">Limitierte Plätze</p>
                </div>
              </div>
            </div>

            {/* Right Column - Visual Element */}
            <div className="relative flex items-center justify-center lg:-mt-8 order-1 lg:order-2">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-500 rounded-2xl opacity-10 blur-2xl" />
              <div className="relative w-full max-w-lg mx-auto">
                <div className="relative overflow-hidden rounded-2xl shadow-xl ring-1 ring-gray-200/60 bg-white aspect-[3/4] sm:aspect-[4/5]">
                  <div className="absolute inset-0 bg-gradient-to-t from-gray-900/75 via-gray-900/35 to-transparent" />
                  <div className="absolute top-4 left-4 right-4 lg:hidden z-10">
                    <h1 className="text-[21px] sm:text-2xl font-bold tracking-tight text-gray-900 leading-snug drop-shadow-sm">
                      Dein{" "}
                      <span className="bg-gradient-to-b from-purple-400 to-blue-500 bg-clip-text text-transparent">
                        Live-Mentoring
                      </span>
                      : ICT verstehen, lernen und anwenden
                    </h1>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className="inline-flex items-center rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-gray-900 ring-1 ring-white/70">
                        <Image
                          src="/images/whop-logo.png"
                          alt="Whop"
                          width={16}
                          height={16}
                          className="mr-2 h-4 w-4"
                        />
                        <span className="mr-2 flex items-center gap-0.5 text-amber-500">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star key={`hero-mobile-star-${i}`} className="h-3.5 w-3.5 fill-current" />
                          ))}
                        </span>
                        {whopAvgText}/5 • {whopCount} Bewertungen
                      </span>
                      <span className="inline-flex items-center rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-gray-900 ring-1 ring-white/70">
                        Limitiert auf 100 Plätze • Start am 01.03.2026
                      </span>
                    </div>
                  </div>
                  <Image
                    src="/images/mentor-image-2.png"
                    alt="Mentorship Live Call"
                    fill
                    className="object-cover"
                    sizes="(max-width: 1024px) 90vw, 520px"
                    priority
                  />
                  <div className="absolute bottom-4 left-4 right-4 grid grid-cols-2 gap-2">
                    <div className="flex items-center gap-2 rounded-xl bg-white/80 px-2.5 py-2 text-xs font-semibold text-gray-900 ring-1 ring-white/90 border border-white/60 shadow-[0_8px_24px_rgba(15,23,42,0.2)] backdrop-blur-md">
                      <div className="h-6 w-6 rounded-lg bg-purple-500/15 text-purple-700 flex items-center justify-center">
                        <Award className="h-3.5 w-3.5" />
                      </div>
                      2 Jahre Coaching-Erfahrung
                    </div>
                    <div className="flex items-center gap-2 rounded-xl bg-white/80 px-2.5 py-2 text-xs font-semibold text-gray-900 ring-1 ring-white/90 border border-white/60 shadow-[0_8px_24px_rgba(15,23,42,0.2)] backdrop-blur-md">
                      <div className="h-6 w-6 rounded-lg bg-blue-500/15 text-blue-700 flex items-center justify-center">
                        <Users className="h-3.5 w-3.5" />
                      </div>
                      130+ erfolgreiche Absolventen
                    </div>
                    <div className="flex items-center gap-2 rounded-xl bg-white/80 px-2.5 py-2 text-xs font-semibold text-gray-900 ring-1 ring-white/90 border border-white/60 shadow-[0_8px_24px_rgba(15,23,42,0.2)] backdrop-blur-md">
                      <div className="h-6 w-6 rounded-lg bg-emerald-500/15 text-emerald-700 flex items-center justify-center">
                        <LineChart className="h-3.5 w-3.5" />
                      </div>
                      Performance sichtbar
                    </div>
                    <div className="flex items-center gap-2 rounded-xl bg-white/80 px-2.5 py-2 text-xs font-semibold text-gray-900 ring-1 ring-white/90 border border-white/60 shadow-[0_8px_24px_rgba(15,23,42,0.2)] backdrop-blur-md">
                      <div className="h-6 w-6 rounded-lg bg-amber-500/15 text-amber-700 flex items-center justify-center">
                        <BadgeCheck className="h-3.5 w-3.5" />
                      </div>
                      Payout‑Nachweis
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid sm:grid-cols-2 gap-3 items-stretch">
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

                  <div className="rounded-xl border bg-white p-4 shadow-sm h-full">
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
                <p className="mt-4 lg:hidden text-base text-gray-600 leading-relaxed">
                  Ich baue dein Verständnis Schritt für Schritt auf: Theorie, danach Live-Tape-Reading und später echtes Live-Trading.
                  Du zahlst monatlich und kannst jederzeit kündigen, wenn der Mehrwert nicht passt.
                </p>
              </div>
            </div>
          </div>
      </div>
    </section>
  )
}