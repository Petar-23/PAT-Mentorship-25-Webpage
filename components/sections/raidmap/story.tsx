import type { RaidMapLang } from '@/lib/raidmap-config'
import { raidmapStory } from '@/lib/raidmap-content'

export default function RaidMapStory({ lang }: { lang: RaidMapLang }) {
  const t = raidmapStory[lang]

  return (
    <section id="story" className="py-20 px-4 md:px-6 bg-gray-50">
      <div className="container mx-auto max-w-5xl">
        <div className="max-w-3xl mb-14">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 text-balance">{t.title}</h2>
          <p className="mt-4 text-lg text-gray-600 text-pretty">{t.subtitle}</p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {t.steps.map((step) => (
            <div key={step.n} className="bg-white rounded-xl border border-gray-200 p-8">
              <span className="text-sm font-semibold text-blue-600 tabular-nums">{step.n}</span>
              <h3 className="mt-3 text-xl font-bold text-gray-900 text-balance">{step.title}</h3>
              <p className="mt-4 text-gray-600 leading-relaxed text-pretty">{step.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
