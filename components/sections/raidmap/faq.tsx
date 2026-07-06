import { CaretDown } from '@phosphor-icons/react/dist/ssr/CaretDown'
import type { RaidMapLang } from '@/lib/raidmap-config'
import { raidmapDisclaimer, raidmapFaq } from '@/lib/raidmap-content'

export default function RaidMapFaq({ lang }: { lang: RaidMapLang }) {
  const t = raidmapFaq[lang]
  const d = raidmapDisclaimer[lang]

  return (
    <section id="faq" className="py-20 px-4 md:px-6 bg-white">
      <div className="container mx-auto max-w-3xl">
        <h2 className="text-3xl md:text-4xl font-bold text-gray-900 text-balance mb-10">
          {t.title}
        </h2>

        <div className="divide-y divide-gray-200 border-y border-gray-200">
          {t.items.map((item) => (
            <details key={item.q} className="group py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-left font-medium text-gray-900">
                <span className="text-pretty">{item.q}</span>
                <CaretDown className="size-4 flex-shrink-0 text-gray-400 transition-transform duration-200 group-open:rotate-180" />
              </summary>
              <p className="mt-3 text-gray-600 leading-relaxed text-pretty">{item.a}</p>
            </details>
          ))}
        </div>

        <div className="mt-14 rounded-xl bg-gray-50 border border-gray-200 p-8">
          <h3 className="text-sm font-semibold uppercase text-gray-500">{d.title}</h3>
          <p className="mt-3 text-sm text-gray-600 leading-relaxed text-pretty">{d.body}</p>
        </div>
      </div>
    </section>
  )
}
