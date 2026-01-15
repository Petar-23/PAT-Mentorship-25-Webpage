'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from "@/components/ui/button"
import { ArrowRight, PlayCircle, Star, Users } from "lucide-react"
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
      className="relative py-12 sm:py-24 md:py-20 lg:py-32 min-h-[85vh] lg:min-h-[65vh] overflow-hidden bg-gradient-to-b from-white to-gray-50"
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
            <div className="space-y-8">
              <div className="inline-block">
                <span className="inline-flex items-center rounded-full px-4 py-1 text-sm font-medium bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-700/10">
                  Limitiert auf 100 Plätze • Start am 01.03.2026
                </span>
              </div>
              
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-gray-900 lg:leading-[1.1]">
                <span className="bg-gradient-to-b from-purple-400 to-blue-500 bg-clip-text text-transparent">
                  Kein Videokurs:
                </span>
                <br />
                ICT live lernen, verstehen und anwenden
              </h1>
              
              <p className="text-lg md:text-xl text-gray-600 leading-relaxed max-w-xl">
                Wir bauen dein Verständnis Schritt für Schritt auf: Theorie, danach Live-Tape-Reading und später echtes Live-Trading.
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
                      Details ansehen
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
                        Platz sichern
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
            <div className="relative flex items-center justify-center lg:-mt-8">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-500 rounded-2xl opacity-10 blur-2xl" />
              <div className="relative bg-white p-5 sm:p-6 lg:p-7 rounded-xl shadow-xl w-full max-w-lg mx-auto">
                <div className="space-y-4 lg:space-y-5">
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 lg:h-12 lg:w-12 rounded-full bg-blue-100 flex items-center justify-center overflow-hidden">
                      <Image
                        src="/images/ict-logo.jpg"
                        alt="ICT Logo"
                        width={48}
                        height={48}
                        className="object-cover w-full h-full"
                      />
                    </div>
                    <div>
                      <h3 className="font-semibold">ICT Konzepte auf Deutsch</h3>
                      <p className="text-sm text-gray-600">Zusammengefasst, Strukturiert & Erklärt</p>
                    </div>
                  </div>
                  
                  <div className="h-px bg-gray-100" />

                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                      <PlayCircle className="h-6 w-6 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold">Live Trading Sessions</h3>
                      <p className="text-sm text-gray-600">Anwendung der Konzepte in Echtzeit</p>
                    </div>
                  </div>
                  
                  <div className="h-px bg-gray-100" />
                  
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-full bg-purple-100 flex items-center justify-center">
                      <Users className="h-6 w-6 text-purple-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold">Q&A Live-Session</h3>
                      <p className="text-sm text-gray-600">Am Monatsende Deep-Dive in eure Fragen</p>
                    </div>
                  </div>

                  <div className="h-px bg-gray-100" />
                  
                  <div className="flex items-center gap-4 mt-2">
                    <div className="bg-green-50 rounded-lg p-3 w-full border">
                      <p className="text-sm text-green-800 font-medium text-wrap">
                       Bleib 12 Monate dabei & erhalte dauerhaft Zugang zu allen Materialien
                      </p>
                    </div>
                  </div>

                  <a
                    href="https://whop.com/price-action-trader-mentorship-24-d9/pat-mentorship-2025/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block"
                  >
                    <div className="rounded-lg border bg-white p-3 hover:bg-gray-50 transition-colors">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <Image
                            src="/images/whop-logo.png"
                            alt="Whop"
                            width={24}
                            height={24}
                            className="h-6 w-6"
                          />
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-gray-900">
                              Whop-Reviews
                            </p>
                            <p className="text-xs text-gray-600 tabular-nums truncate">
                              {whopAvgText} von 5 Sterne ({whopCount} Bewertungen){whopStats ? '' : ''}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 text-amber-500 flex-shrink-0">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star key={i} className="h-4 w-4 fill-current" />
                          ))}
                        </div>
                      </div>
                    </div>
                  </a>
                </div>
              </div>
            </div>
          </div>
      </div>
    </section>
  )
}