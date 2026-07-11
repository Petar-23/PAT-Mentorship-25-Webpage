import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight } from '@phosphor-icons/react/dist/ssr/ArrowRight'
import { Check } from '@phosphor-icons/react/dist/ssr/Check'
import { Button } from '@/components/ui/button'
import { RAIDMAP_CONFIG, type RaidMapLang } from '@/lib/raidmap-config'
import { raidmapHero, raidmapProof, raidmapUi } from '@/lib/raidmap-content'

export default function RaidMapHero({ lang }: { lang: RaidMapLang }) {
  const t = raidmapHero[lang]
  const proof = raidmapProof[lang]
  const ui = raidmapUi[lang]
  const docsHref = lang === 'en' ? RAIDMAP_CONFIG.docsPathEn : RAIDMAP_CONFIG.docsPathDe
  const compactBadge = lang === 'en'
    ? 'TradingView · NQ · OOS tested'
    : 'TradingView · NQ · OOS-getestet'
  const localeShortLabel = lang === 'en' ? 'DE' : 'EN'
  const previewLabel = lang === 'en' ? 'Live NQ chart' : 'Live-NQ-Chart'
  const previewAlt = lang === 'en'
    ? 'PAT Raid Map preview on a live NQ chart'
    : 'PAT Raid Map Vorschau auf einem Live-NQ-Chart'

  return (
    <section data-raidmap-hero className="bg-white px-4 pb-10 pt-8 sm:pt-10 md:px-6 md:pb-14 md:pt-16">
      <div className="mx-auto w-full max-w-5xl">
        <div className="mb-7 flex items-center justify-between gap-3 md:mb-10">
          <span className="inline-flex min-w-0 items-center rounded-full bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 ring-1 ring-inset ring-blue-700/10 sm:px-4 sm:text-sm">
            <span className="sm:hidden">{compactBadge}</span>
            <span className="hidden sm:inline">{t.badge}</span>
          </span>
          <Link
            href={ui.langSwitchHref}
            aria-label={ui.langSwitch}
            className="inline-flex min-h-8 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-600 shadow-sm transition-colors hover:border-gray-300 hover:text-gray-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 sm:text-sm"
          >
            <span className="sm:hidden">{localeShortLabel}</span>
            <span className="hidden sm:inline">{ui.langSwitch}</span>
          </Link>
        </div>

        <div className="grid items-start gap-x-10 lg:grid-cols-2 lg:grid-rows-[auto_auto] xl:gap-x-14">
          <div className="lg:col-start-1 lg:row-start-1">
            <h1 className="text-[2.5rem] font-bold leading-[1.04] text-gray-950 text-balance sm:text-5xl md:text-6xl md:leading-[1.02]">
              {t.title}
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-gray-600 text-pretty sm:text-lg md:mt-6 md:text-xl md:leading-8">
              {t.subtitle}
            </p>
          </div>

          <div className="mt-5 overflow-hidden rounded-xl border border-gray-200 bg-gray-950 shadow-sm lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:mt-0 lg:self-center">
            <div className="relative aspect-[2/1] lg:aspect-[1.65/1]">
              <Image
                src="/images/raidmap/chart-example.png"
                alt={previewAlt}
                width={1952}
                height={1186}
                priority
                sizes="(max-width: 1023px) calc(100vw - 32px), 560px"
                className="h-full w-full object-cover object-center"
              />
              <span className="absolute left-3 top-3 rounded-full bg-gray-950/85 px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm backdrop-blur-sm">
                {previewLabel}
              </span>
            </div>
          </div>

          <div className="mt-5 lg:col-start-1 lg:row-start-2 lg:mt-7">
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="min-h-12 w-full px-6 text-base sm:w-auto sm:px-8 sm:text-lg">
                <Link href="#pricing">
                  {t.ctaPrimary}
                  <ArrowRight aria-hidden="true" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="hidden min-h-12 px-6 text-base sm:inline-flex sm:px-8 sm:text-lg">
                <Link href={docsHref}>{t.ctaSecondary}</Link>
              </Button>
              <Link
                href={docsHref}
                className="inline-flex min-h-8 items-center justify-center gap-1.5 text-sm font-semibold text-gray-700 underline decoration-gray-300 underline-offset-4 hover:text-gray-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 sm:hidden"
              >
                {t.ctaSecondary}
                <ArrowRight aria-hidden="true" />
              </Link>
            </div>

            <p className="mt-3 text-xs font-semibold leading-5 text-blue-700 sm:text-sm">{t.urgency}</p>
          </div>
        </div>

        <ul className="mt-8 grid gap-4 border-t border-gray-100 pt-7 md:mt-10 md:grid-cols-3 md:gap-6 md:pt-8">
          {t.bullets.map((b) => (
            <li key={b} className="flex items-start gap-3">
              <Check aria-hidden="true" className="mt-0.5 size-5 flex-shrink-0 text-blue-600" />
              <span className="text-sm leading-6 text-gray-700 text-pretty sm:text-base">{b}</span>
            </li>
          ))}
        </ul>

        <p className="mt-7 max-w-2xl text-xs leading-5 text-gray-400 text-pretty">{t.finePrint}</p>

        <dl className="mt-10 grid grid-cols-2 gap-5 border-t border-gray-100 pt-8 md:mt-14 md:grid-cols-4 md:gap-6 md:pt-10">
          {proof.items.map((item) => (
            <div key={item.label}>
              <dt className="sr-only">{item.label}</dt>
              <dd className="text-2xl font-bold text-gray-900 tabular-nums md:text-3xl">
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
