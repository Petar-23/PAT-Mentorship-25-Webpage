import { prisma, withPrismaRetry } from '@/lib/prisma'
import type { RaidMapLang } from '@/lib/raidmap-config'
import { raidmapTestimonials } from '@/lib/raidmap-content'

// Echter Social Proof über Zeit: zeigt NUR approved Testimonials
// (Review-Gate unter /mentorship/testimonials). Bei 0 approved — oder wenn
// die Tabelle (noch) nicht erreichbar ist — rendert die Sektion NICHTS:
// kein Fake-Social-Proof, keine Platzhalter, kein 500er auf der Landing.
async function loadApprovedTestimonials() {
  try {
    return await withPrismaRetry(
      () =>
        prisma.raidMapTestimonial.findMany({
          where: { status: 'approved' },
          orderBy: { createdAt: 'desc' },
          take: 6,
          select: { id: true, displayName: true, text: true, rating: true },
        }),
      { label: 'Load approved raidmap testimonials' }
    )
  } catch (error) {
    console.error('[raidmap] testimonials unavailable (section hidden):', error)
    return []
  }
}

function Stars({ rating }: { rating: number }) {
  const filled = Math.max(0, Math.min(5, rating))
  return (
    <p className="text-amber-400 text-lg leading-none" aria-label={`${filled} out of 5 stars`}>
      {'★'.repeat(filled)}
      <span className="text-gray-200">{'★'.repeat(5 - filled)}</span>
    </p>
  )
}

export default async function RaidMapTestimonials({ lang }: { lang: RaidMapLang }) {
  const t = raidmapTestimonials[lang]
  const testimonials = await loadApprovedTestimonials()

  if (testimonials.length === 0) return null

  return (
    <section id="testimonials" className="py-20 px-4 md:px-6 bg-white">
      <div className="container mx-auto max-w-6xl">
        <div className="max-w-3xl mb-14">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 text-balance">{t.title}</h2>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {testimonials.map((item) => (
            <figure key={item.id} className="rounded-xl border border-gray-200 p-7 flex flex-col">
              <Stars rating={item.rating} />
              <blockquote className="mt-4 flex-1 text-sm text-gray-600 leading-relaxed text-pretty whitespace-pre-line">
                {item.text}
              </blockquote>
              <figcaption className="mt-4 pt-4 border-t border-gray-100 text-sm font-semibold text-gray-900">
                {item.displayName}
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  )
}
