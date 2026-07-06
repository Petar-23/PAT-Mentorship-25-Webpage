'use client'

import dynamic from 'next/dynamic'
import { useEffect, useRef, useState } from 'react'
import { MENTORSHIP_CONFIG } from '@/lib/config'

const FinalCTA = dynamic(() => import('@/components/sections/final-cta'), {
  ssr: false,
  loading: () => <FinalCtaFallback />,
})

export default function LazyFinalCtaSection() {
  const sectionRef = useRef<HTMLDivElement>(null)
  const [shouldLoad, setShouldLoad] = useState(false)

  useEffect(() => {
    if (shouldLoad) return

    const node = sectionRef.current
    if (!node || typeof IntersectionObserver === 'undefined') {
      const raf = requestAnimationFrame(() => setShouldLoad(true))
      return () => cancelAnimationFrame(raf)
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShouldLoad(true)
          observer.disconnect()
        }
      },
      { rootMargin: '1600px 0px' }
    )

    observer.observe(node)
    return () => observer.disconnect()
  }, [shouldLoad])

  return (
    <div ref={sectionRef}>
      {shouldLoad ? <FinalCTA /> : <FinalCtaFallback />}
    </div>
  )
}

function FinalCtaFallback() {
  return (
    <section className="relative overflow-hidden py-12 sm:py-24" aria-label="Abschluss-CTA wird geladen">
      <div className="absolute inset-0 bg-slate-950" />
      <div className="container relative z-10 mx-auto px-4 max-w-6xl">
        <div className="text-center mb-8 sm:mb-16">
          <div className="flex justify-center mb-4 sm:mb-6">
            <div className="inline-flex items-center gap-1.5 sm:gap-2 pl-1.5 sm:pl-2 pr-3 sm:pr-4 py-1 rounded-full bg-white/10 ring-1 ring-white/20">
              <div className="bg-blue-500/20 text-blue-400 rounded-full px-2 py-0.5 text-xs sm:text-sm">🚀</div>
              <span className="text-xs sm:text-sm font-medium text-blue-400">Jetzt starten</span>
            </div>
          </div>
          <h2 className="text-2xl sm:text-4xl md:text-5xl font-bold text-white mb-4 sm:mb-6">
            Deine Trading-Reise <br />
            <span className="text-blue-400">Beginnt im {MENTORSHIP_CONFIG.startMonthYear}</span>
          </h2>
          <p className="text-sm sm:text-xl text-gray-300 max-w-2xl mx-auto">
            Werde einer von {MENTORSHIP_CONFIG.maxSpots} ambitionierten Tradern und erlebe ein transformatives Jahr
            mit Live-Marktanalysen, Echtzeit-Trading und messbarem Wachstum.
          </p>
        </div>

        <div className="mx-auto mb-12 grid max-w-md grid-cols-2 gap-2 text-center sm:grid-cols-4">
          {['Tage', 'Std', 'Min', 'Sek'].map((label) => (
            <div key={label} className="rounded-md border border-slate-700 bg-slate-900/80 px-4 py-3 text-slate-100">
              <div className="text-xl font-bold">00</div>
              <div className="text-xs uppercase tracking-wide text-slate-400">{label}</div>
            </div>
          ))}
        </div>

        <div className="text-center">
          <div className="inline-flex h-12 items-center justify-center rounded-md bg-white/90 px-6 text-sm font-medium text-slate-900 sm:h-14 sm:px-8 sm:text-lg">
            Prüfen ob Plätze frei sind
          </div>
          <p className="mt-4 sm:mt-6 text-xs sm:text-base text-gray-400">
            Keine Zahlung bis zum Programmstart.
          </p>
        </div>
      </div>
    </section>
  )
}
