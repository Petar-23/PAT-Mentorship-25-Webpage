'use client'

import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import { Medal as Award } from "@phosphor-icons/react/Medal"
import { Play } from "@phosphor-icons/react/Play"
import { Star } from "@phosphor-icons/react/Star"
import { Users } from "@phosphor-icons/react/Users"
import { Button } from "@/components/ui/button"
import { CardWithMatrix } from "@/components/ui/card-with-matrix"
import { getWhopReviewStats } from '@/lib/whop-review-stats'

export function MentorStatsCards({ compact = false }: { compact?: boolean }) {
  return (
    <>
      <CardWithMatrix
        icon={<Users className="h-full w-full" />}
        value="130+"
        subtitle="Mentees seit 2024"
        iconColor="text-blue-400"
        rainColor="#60A5FA"
        gradientColor="rgba(96, 165, 250, 0.2)"
      />
      <CardWithMatrix
        icon={<Award className="h-full w-full" />}
        title="Mentor-Erfahrung"
        iconColor="text-purple-400"
        rainColor="#A78BFA"
        gradientColor="rgba(167, 139, 250, 0.2)"
      >
        <div className={compact ? "p-2.5 sm:p-6" : "p-6"}>
          <div className={compact ? "flex items-center gap-2 sm:gap-4" : "flex items-center gap-4"}>
            <div className={compact ? "h-6 w-6 sm:h-10 sm:w-10 text-purple-400" : "h-10 w-10 text-purple-400"}>
              <Award className="h-full w-full" />
            </div>
            <div>
              <p className={compact ? "text-sm sm:text-2xl font-bold text-white whitespace-nowrap" : "text-lg sm:text-2xl font-bold text-white whitespace-nowrap"}>
                2 Jahre
              </p>
              <p className={compact ? "text-[10px] sm:text-sm text-gray-400" : "text-sm text-gray-400"}>Mentor-Erfahrung</p>
            </div>
          </div>
        </div>
      </CardWithMatrix>
    </>
  )
}

export function MentorWhopReviewCard({ compact = false }: { compact?: boolean }) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [shouldLoadStats, setShouldLoadStats] = useState(false)
  const [whopReviewCount, setWhopReviewCount] = useState<number | null>(null)
  const [whopReviewsError, setWhopReviewsError] = useState(false)

  useEffect(() => {
    if (shouldLoadStats) return

    const node = cardRef.current
    if (!node || typeof window === 'undefined') {
      const raf = requestAnimationFrame(() => setShouldLoadStats(true))
      return () => cancelAnimationFrame(raf)
    }

    if (typeof IntersectionObserver === 'undefined') {
      const raf = requestAnimationFrame(() => setShouldLoadStats(true))
      return () => cancelAnimationFrame(raf)
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShouldLoadStats(true)
          observer.disconnect()
        }
      },
      { rootMargin: '800px 0px' }
    )

    observer.observe(node)
    return () => observer.disconnect()
  }, [shouldLoadStats])

  useEffect(() => {
    if (!shouldLoadStats) return

    let cancelled = false

    async function loadWhopReviewCount() {
      try {
        const stats = await getWhopReviewStats()
        if (!stats) throw new Error('Failed to load reviews')
        if (!cancelled) setWhopReviewCount(stats.count)
      } catch {
        if (!cancelled) setWhopReviewsError(true)
      }
    }

    loadWhopReviewCount()
    return () => {
      cancelled = true
    }
  }, [shouldLoadStats])

  const reviewText = whopReviewsError
    ? 'Whop Reviews aktuell nicht verfügbar'
    : whopReviewCount == null
      ? 'Bewertungen werden geladen...'
      : `${whopReviewCount >= 200 ? '200+' : whopReviewCount} Bewertungen (Whop)`

  return (
    <div ref={cardRef}>
      <CardWithMatrix
        icon={
          <div className="relative h-full w-full">
            <Image
              src="/images/whop-logo.png"
              alt="Whop"
              fill
              className="object-contain"
              sizes="40px"
            />
          </div>
        }
        title="Whop Reviews"
        iconColor="text-yellow-300"
        rainColor="#FBBF24"
        gradientColor="rgba(251, 191, 36, 0.18)"
        className="lg:min-h-[130px]"
      >
        <div className={compact ? "p-3 sm:p-6 flex items-center lg:min-h-[130px]" : "p-6 flex items-center lg:min-h-[130px]"}>
          <div className={compact ? "flex items-center gap-2 sm:gap-4" : "flex items-center gap-4"}>
            <div className={compact ? "h-8 w-8 sm:h-10 sm:w-10" : "h-10 w-10"}>
              <div className={compact ? "relative h-8 w-8 sm:h-10 sm:w-10" : "relative h-10 w-10"}>
                <Image
                  src="/images/whop-logo.png"
                  alt="Whop"
                  fill
                  className="object-contain"
                  sizes="40px"
                />
              </div>
            </div>
            <div className="min-w-0">
              <div className={compact ? "flex items-center gap-0.5 sm:gap-1 text-amber-400" : "flex items-center gap-1 text-amber-400"}>
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    weight="fill"
                    className={compact ? "h-3 w-3 sm:h-4 sm:w-4 fill-current" : "h-4 w-4 fill-current"}
                  />
                ))}
              </div>
              <p className={compact ? "text-xs sm:text-sm text-gray-400 mt-0.5 sm:mt-1" : "text-sm text-gray-400 mt-1"}>
                {reviewText}
              </p>
            </div>
          </div>
        </div>
      </CardWithMatrix>
    </div>
  )
}

export function MentorLessonCard({ compact = false }: { compact?: boolean }) {
  return (
    <CardWithMatrix
      icon={<Play className="h-full w-full" />}
      title="Trading Range Analyse"
      iconColor="text-red-400"
      rainColor="#60A5FA"
      gradientColor="rgba(96, 165, 250, 0.2)"
      className="overflow-hidden"
    >
      <div className={compact ? "relative p-3 sm:p-6" : "relative p-6"}>
        <div className="aspect-[16/8] relative bg-slate-900">
          <Image
            src="https://i.ytimg.com/vi/63V_7Ji_omw/hqdefault.jpg"
            alt="Trading Range Analyse"
            fill
            className="object-cover"
            sizes={compact ? "(max-width: 1024px) 100vw, 520px" : "520px"}
          />
          <div className="absolute inset-0 bg-black/40" />
          <Button
            aria-label="Video abspielen"
            onClick={() => {
              window.open('https://www.youtube.com/watch?v=63V_7Ji_omw', '_blank')
            }}
            className={compact ? "absolute inset-0 m-auto w-10 h-10 sm:w-14 sm:h-14 rounded-full bg-red-600 hover:bg-red-700 flex items-center justify-center group border-2 border-white/20" : "absolute inset-0 m-auto w-14 h-14 rounded-full bg-red-600 hover:bg-red-700 flex items-center justify-center group border-2 border-white/20"}
          >
            <Play className={compact ? "h-5 w-5 sm:h-7 sm:w-7 text-white group-hover:scale-110 transition-transform" : "h-7 w-7 text-white group-hover:scale-110 transition-transform"} />
          </Button>
        </div>
        <div className={compact ? "pt-3 sm:pt-6" : "pt-6"}>
          <p className={compact ? "font-semibold text-white text-sm sm:text-lg mb-2 sm:mb-4" : "font-semibold text-white text-lg mb-4"}>
            Beispiel Lektion aus der PAT Mentorship 2025
          </p>
          <div className={compact ? "flex flex-wrap gap-1.5 sm:gap-2" : "flex flex-wrap gap-2"}>
            <span className={compact ? "px-1.5 sm:px-2 py-0.5 sm:py-1 bg-slate-800 rounded-md text-blue-400 text-[10px] sm:text-sm" : "px-2 py-1 bg-slate-800 rounded-md text-blue-400 text-sm"}>
              Live Ausführung
            </span>
            <span className={compact ? "px-1.5 sm:px-2 py-0.5 sm:py-1 bg-slate-800 rounded-md text-blue-400 text-[10px] sm:text-sm" : "px-2 py-1 bg-slate-800 rounded-md text-blue-400 text-sm"}>
              ICT Modell 22
            </span>
            <span className={compact ? "px-1.5 sm:px-2 py-0.5 sm:py-1 bg-slate-800 rounded-md text-blue-400 text-[10px] sm:text-sm" : "px-2 py-1 bg-slate-800 rounded-md text-blue-400 text-sm"}>
              Lektion
            </span>
          </div>
        </div>
      </div>
    </CardWithMatrix>
  )
}
