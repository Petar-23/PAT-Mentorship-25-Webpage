import { Check } from '@phosphor-icons/react/dist/ssr/Check'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { RaidMapCheckoutButton } from '@/components/ui/raidmap-checkout-button'
import { RAIDMAP_CONFIG, type RaidMapLang } from '@/lib/raidmap-config'
import { raidmapPricing } from '@/lib/raidmap-content'

const checkoutLabels = {
  en: { loading: 'Redirecting…', error: 'Could not start checkout. Please try again in a moment.' },
  de: { loading: 'Wird weitergeleitet…', error: 'Checkout konnte nicht gestartet werden. Bitte versuche es gleich erneut.' },
} as const

export default function RaidMapPricing({ lang }: { lang: RaidMapLang }) {
  const t = raidmapPricing[lang]
  const labels = checkoutLabels[lang]
  const c = RAIDMAP_CONFIG

  return (
    <section id="pricing" className="py-20 px-4 md:px-6 bg-gray-50">
      <div className="container mx-auto max-w-5xl">
        <div className="text-center mb-14">
          <span className="inline-flex items-center rounded-full bg-blue-600 px-4 py-1 text-sm font-medium text-white">
            {t.launchBadge}
          </span>
          <h2 className="mt-5 text-3xl md:text-4xl font-bold text-gray-900 text-balance">{t.title}</h2>
          <p className="mt-4 text-lg text-gray-600 text-pretty">{t.subtitle}</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 items-stretch">
          <Card className="relative">
            <CardHeader className="text-center">
              <CardTitle className="text-xl">{t.monthly.name}</CardTitle>
              <div className="mt-4">
                <span className="text-2xl font-semibold text-gray-400 line-through tabular-nums mr-3">
                  {t.monthly.strike}
                </span>
                <span className="text-5xl font-bold tabular-nums">{c.monthlyPriceFormatted}</span>
                <span className="text-gray-600 text-lg">{t.monthly.period}</span>
              </div>
              <p className="text-sm text-gray-500 mt-2">{t.monthly.note}</p>
            </CardHeader>
            <CardContent>
              <RaidMapCheckoutButton
                tier="monthly"
                lang={lang}
                variant="outline"
                label={t.monthly.cta}
                loadingLabel={labels.loading}
                errorMessage={labels.error}
              />
            </CardContent>
          </Card>

          <Card className="relative border-2 border-blue-600">
            <div className="absolute top-0 right-0 mr-6 -mt-4">
              <span className="inline-flex items-center rounded-full bg-blue-600 px-4 py-1 text-sm font-medium text-white">
                {t.annual.badge}
              </span>
            </div>
            <CardHeader className="text-center">
              <CardTitle className="text-xl">{t.annual.name}</CardTitle>
              <div className="mt-4">
                <span className="text-2xl font-semibold text-gray-400 line-through tabular-nums mr-3">
                  {t.annual.strike}
                </span>
                <span className="text-5xl font-bold tabular-nums">{c.annualMonthlyPriceFormatted}</span>
                <span className="text-gray-600 text-lg">{t.annual.period}</span>
              </div>
              <p className="text-sm text-gray-500 mt-2">{t.annual.note}</p>
            </CardHeader>
            <CardContent>
              <RaidMapCheckoutButton
                tier="annual"
                lang={lang}
                label={t.annual.cta}
                loadingLabel={labels.loading}
                errorMessage={labels.error}
              />
            </CardContent>
          </Card>
        </div>

        <div className="mt-10 bg-white rounded-xl border border-gray-200 p-8">
          <ul className="grid md:grid-cols-2 gap-x-8 gap-y-4">
            {t.included.map((item) => (
              <li key={item} className="flex items-start gap-3">
                <Check className="size-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <span className="text-gray-700 text-pretty">{item}</span>
              </li>
            ))}
          </ul>
          <p className="mt-6 text-sm text-gray-500 text-pretty">{t.loginNote}</p>
          <p className="mt-2 text-sm font-medium text-gray-700 text-pretty">
            {t.trialNote} {t.lockNote}
          </p>
        </div>

        <p className="mt-8 text-xs text-gray-400 text-center max-w-3xl mx-auto text-pretty">
          {t.legalNote}
        </p>
      </div>
    </section>
  )
}
