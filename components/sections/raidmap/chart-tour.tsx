import Image from 'next/image'
import Link from 'next/link'
import type { RaidMapLang } from '@/lib/raidmap-config'
import { raidmapChartTour } from '@/lib/raidmap-content'

// Echter Live-Chart + 5-Punkte-Legende (zwischen Story und Features).
// Kompakt halten: ein Screen, kein eigener CTA-Block — nur ein dezenter
// Sekundär-Link auf #pricing.
export default function RaidMapChartTour({ lang }: { lang: RaidMapLang }) {
  const t = raidmapChartTour[lang]

  return (
    <section id="chart-tour" className="scroll-mt-20 bg-white px-4 py-14 md:px-6 md:py-20">
      <div className="container mx-auto max-w-5xl">
        <div className="max-w-3xl mb-10">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 text-balance">{t.title}</h2>
          <p className="mt-4 text-lg text-gray-600 text-pretty">{t.subtitle}</p>
        </div>

        <div className="overflow-hidden rounded-xl border border-gray-200">
          <Image
            src="/images/raidmap/chart-example.png"
            alt={t.imageAlt}
            width={1952}
            height={1186}
            sizes="(max-width: 1024px) 100vw, 1024px"
            className="w-full h-auto"
          />
        </div>

        <dl className="mt-8 grid sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-5">
          {t.items.map((item) => (
            <div key={item.label}>
              <dt className="text-sm font-bold text-gray-900 text-balance">{item.label}</dt>
              <dd className="mt-1 text-sm text-gray-600 leading-relaxed text-pretty">{item.body}</dd>
            </div>
          ))}
        </dl>

        <p className="mt-8 text-sm">
          <Link href="#pricing" className="font-medium text-blue-700 underline underline-offset-4 hover:text-blue-900">
            {t.pricingCta}
          </Link>
        </p>
      </div>
    </section>
  )
}
