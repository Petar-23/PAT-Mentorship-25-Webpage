'use client'

import dynamic from 'next/dynamic'
import { useEffect, useRef, useState } from 'react'

const Testimonials = dynamic(() => import('@/components/sections/testimonials'), {
  ssr: false,
  loading: () => <TestimonialsFallback />,
})

export default function LazyTestimonialsSection() {
  const sectionRef = useRef<HTMLDivElement>(null)
  const [shouldLoad, setShouldLoad] = useState(false)

  useEffect(() => {
    if (shouldLoad) return

    const node = sectionRef.current
    if (!node) {
      const raf = requestAnimationFrame(() => setShouldLoad(true))
      return () => cancelAnimationFrame(raf)
    }

    if (typeof IntersectionObserver === 'undefined') {
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
      { rootMargin: '1200px 0px' }
    )

    observer.observe(node)
    return () => observer.disconnect()
  }, [shouldLoad])

  return (
    <div ref={sectionRef}>
      {shouldLoad ? <Testimonials /> : <TestimonialsFallback />}
    </div>
  )
}

function TestimonialsFallback() {
  return (
    <section className="py-24 bg-white" aria-label="Erfolgsgeschichten werden geladen">
      <div className="container mx-auto px-4 max-w-6xl">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-1.5 sm:gap-2 pl-1.5 sm:pl-2 pr-3 sm:pr-4 py-1 rounded-full bg-blue-50 ring-1 ring-blue-200 mb-4">
            <div className="bg-blue-100 text-blue-700 rounded-full px-2 py-0.5 text-xs sm:text-sm">🏆</div>
            <span className="text-xs sm:text-sm font-medium text-blue-700">Erfolgsgeschichten</span>
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">
            PAT Trader Erfolgsgeschichten
          </h2>
          <p className="text-gray-600 max-w-2xl mx-auto text-lg">
            Höre die Meinung von erfolgreichen Mentorship Absolventen
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-12">
          {[
            ['50+', 'Gefundete FK-Konten'],
            ['$60K+', 'Kombinierte Payouts'],
            ['130+', 'Erfolgreiche Mentees'],
            ['5,0★', 'Whop-Reviews'],
          ].map(([value, label]) => (
            <div
              key={label}
              className="rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-slate-100/60 p-2.5 sm:p-4"
            >
              <p className="text-base sm:text-xl font-bold text-slate-500">{value}</p>
              <p className="text-[10px] sm:text-sm text-slate-500 leading-tight">{label}</p>
            </div>
          ))}
        </div>

        <div className="grid gap-4 md:grid-cols-3" aria-hidden="true">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4 h-4 w-24 rounded-full bg-slate-100" />
              <div className="space-y-2">
                <div className="h-3 rounded-full bg-slate-100" />
                <div className="h-3 rounded-full bg-slate-100" />
                <div className="h-3 w-2/3 rounded-full bg-slate-100" />
              </div>
              <div className="mt-6 h-8 w-28 rounded-full bg-slate-100" />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
