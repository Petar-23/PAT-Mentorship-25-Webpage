import type { RaidMapLang } from '@/lib/raidmap-config'
import { raidmapFeatures } from '@/lib/raidmap-content'

export default function RaidMapFeatures({ lang }: { lang: RaidMapLang }) {
  const t = raidmapFeatures[lang]

  return (
    <section id="features" className="py-20 px-4 md:px-6 bg-white">
      <div className="container mx-auto max-w-6xl">
        <div className="max-w-3xl mb-14">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 text-balance">{t.title}</h2>
          <p className="mt-4 text-lg text-gray-600 text-pretty">{t.subtitle}</p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {t.cards.map((card) => (
            <div key={card.title} className="rounded-xl border border-gray-200 p-7 flex flex-col">
              <h3 className="text-lg font-bold text-gray-900 text-balance">{card.title}</h3>
              <p className="mt-4 text-3xl font-bold text-blue-600 tabular-nums">{card.stat}</p>
              <p className="mt-1 text-xs text-gray-500 text-pretty">{card.statNote}</p>
              <p className="mt-4 text-sm text-gray-600 leading-relaxed text-pretty">{card.body}</p>
            </div>
          ))}
        </div>

        <p className="mt-10 text-xs text-gray-400 text-pretty">{t.sourceNote}</p>
      </div>
    </section>
  )
}
