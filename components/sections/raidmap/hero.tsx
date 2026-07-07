import Link from 'next/link'
import { Check } from '@phosphor-icons/react/dist/ssr/Check'
import { Button } from '@/components/ui/button'
import { RAIDMAP_CONFIG, type RaidMapLang } from '@/lib/raidmap-config'
import { raidmapHero, raidmapProof, raidmapUi } from '@/lib/raidmap-content'

export default function RaidMapHero({ lang }: { lang: RaidMapLang }) {
  const t = raidmapHero[lang]
  const proof = raidmapProof[lang]
  const ui = raidmapUi[lang]
  const docsHref = lang === 'en' ? RAIDMAP_CONFIG.docsPathEn : RAIDMAP_CONFIG.docsPathDe

  return (
    <section className="pt-16 pb-12 px-4 md:px-6 bg-white">
      <div className="container mx-auto max-w-5xl">
        <div className="flex items-center justify-between gap-4 mb-10">
          <span className="inline-flex items-center rounded-full bg-blue-50 px-4 py-1 text-sm font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10">
            {t.badge}
          </span>
          <Link
            href={ui.langSwitchHref}
            className="text-sm text-gray-500 underline underline-offset-4 hover:text-gray-900"
          >
            {ui.langSwitch}
          </Link>
        </div>

        <h1 className="text-4xl md:text-6xl font-bold text-gray-900 text-balance">
          {t.title}
        </h1>
        <p className="mt-6 text-lg md:text-xl text-gray-600 max-w-3xl text-pretty">
          {t.subtitle}
        </p>

        <ul className="mt-8 space-y-3">
          {t.bullets.map((b) => (
            <li key={b} className="flex items-start gap-3">
              <Check className="size-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <span className="text-gray-700 text-pretty">{b}</span>
            </li>
          ))}
        </ul>

        <div className="mt-10 flex flex-col sm:flex-row gap-4">
          <Button asChild size="lg" className="text-lg px-8">
            <Link href="#pricing">{t.ctaPrimary}</Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="text-lg px-8">
            <Link href={docsHref}>{t.ctaSecondary}</Link>
          </Button>
        </div>

        <p className="mt-4 text-sm font-medium text-blue-700">{t.urgency}</p>

        <p className="mt-4 text-xs text-gray-400 max-w-2xl text-pretty">{t.finePrint}</p>

        <dl className="mt-14 grid grid-cols-2 md:grid-cols-4 gap-6 border-t border-gray-100 pt-10">
          {proof.items.map((item) => (
            <div key={item.label}>
              <dt className="sr-only">{item.label}</dt>
              <dd className="text-2xl md:text-3xl font-bold text-gray-900 tabular-nums">
                {item.value}
              </dd>
              <p className="mt-1 text-sm text-gray-500">{item.label}</p>
            </div>
          ))}
        </dl>
      </div>
    </section>
  )
}
