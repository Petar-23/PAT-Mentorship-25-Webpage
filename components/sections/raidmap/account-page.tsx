import fs from 'fs'
import path from 'path'
import Image from 'next/image'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'
import { Check } from '@phosphor-icons/react/dist/ssr/Check'
import { Button } from '@/components/ui/button'
import { ManageSubscriptionButton } from '@/components/ui/manage-subscription'
import { TestimonialForm } from '@/components/sections/raidmap/testimonial-form'
import { TvUsernameForm } from '@/components/sections/raidmap/tv-username-form'
import { listIndicatorClaimsForUser, getTradingViewAccountForUser } from '@/lib/indicators/store'
import { getRaidMapAccessState, getRaidMapIndicator } from '@/lib/raidmap-access'
import { RAIDMAP_CONFIG, type RaidMapLang } from '@/lib/raidmap-config'
import { isRaidMapTestMode, RAIDMAP_TEST_USER_ID } from '@/lib/raidmap-test-mode'

const copy = {
  en: {
    heading: 'PAT Raid Map - your account',
    subscriptionTitle: 'Subscription',
    active: 'Active',
    annualPlan: 'annual plan',
    monthlyPlan: 'monthly plan',
    freeTrial: 'free trial',
    noSubscription: 'No active Raid Map subscription on this account.',
    plansLink: 'See plans',
    refreshHint: 'If you just purchased, this can take a minute. Refresh shortly.',
    manageSubscription: 'Manage subscription & invoices',
    documentation: 'Documentation',
    portalHint: 'Cancel, switch plans, update payment details and download invoices in the billing portal.',
    tradingViewTitle: 'TradingView access',
    tradingViewActive: 'Access is granted to your TradingView username (a free TradingView account is enough).',
    tradingViewInactive: 'Access provisioning appears here once your subscription is active.',
    statusFallback: 'status',
    findTitle: 'Where to find the indicator',
    findSteps: [
      'Open any chart on TradingView and click "Indicators".',
      'In the left sidebar choose "Invite-only".',
      'Select "PAT Raid Map". It stays in your list.',
    ],
    imageAlt: 'TradingView indicators dialog with the Invite-only section highlighted',
    questions: 'Questions?',
    experienceTitle: 'Share your experience',
    experienceActive: 'Tell other traders what the map does for you. Your words go live on the Raid Map page after a quick review.',
    experienceInactive: 'You can share your experience here once your subscription is active.',
  },
  de: {
    heading: 'PAT Raid Map - dein Account',
    subscriptionTitle: 'Abonnement',
    active: 'Aktiv',
    annualPlan: 'Jahresabo',
    monthlyPlan: 'Monatsabo',
    freeTrial: 'kostenloser Testzeitraum',
    noSubscription: 'Für diesen Account wurde noch kein aktives Raid-Map-Abo gefunden.',
    plansLink: 'Tarife ansehen',
    refreshHint: 'Wenn du gerade bestellt hast, kann die Aktivierung eine Minute dauern. Lade die Seite gleich noch einmal.',
    manageSubscription: 'Abo & Rechnungen verwalten',
    documentation: 'Anleitung',
    portalHint: 'Im Zahlungsportal kannst du kündigen, den Tarif wechseln, Zahlungsdaten ändern und Rechnungen herunterladen.',
    tradingViewTitle: 'TradingView-Zugang',
    tradingViewActive: 'Der Zugang wird für deinen TradingView-Usernamen freigeschaltet. Ein kostenloser TradingView-Account reicht aus.',
    tradingViewInactive: 'Sobald dein Abo aktiv ist, kannst du hier deinen TradingView-Zugang verwalten.',
    statusFallback: 'Status',
    findTitle: 'So findest du den Indikator',
    findSteps: [
      'Öffne einen beliebigen Chart auf TradingView und klicke auf "Indikatoren".',
      'Wähle links "Invite-only" aus.',
      'Wähle "PAT Raid Map". Der Indikator bleibt anschließend in deiner Liste.',
    ],
    imageAlt: 'TradingView-Indikatorenfenster mit hervorgehobenem Invite-only-Bereich',
    questions: 'Fragen?',
    experienceTitle: 'Teile deine Erfahrung',
    experienceActive: 'Erzähle anderen Tradern, wie dir die Raid Map hilft. Dein Beitrag erscheint nach einer kurzen Prüfung auf der Raid-Map-Seite.',
    experienceInactive: 'Sobald dein Abo aktiv ist, kannst du hier deine Erfahrung teilen.',
  },
} as const

const claimStatusCopy: Record<RaidMapLang, Record<string, string>> = {
  en: {
    granted: 'Access granted. The indicator is live on your TradingView account.',
    pending: 'Access request queued. It is usually processed within the hour.',
    processing: 'Access request is being processed right now.',
    needs_session: 'Queued and waiting for the access worker.',
    failed: 'The last attempt failed. Please check your username and try again.',
  },
  de: {
    granted: 'Zugang erteilt. Der Indikator ist in deinem TradingView-Account verfügbar.',
    pending: 'Deine Freigabe ist vorgemerkt und wird normalerweise innerhalb einer Stunde verarbeitet.',
    processing: 'Deine Freigabe wird gerade verarbeitet.',
    needs_session: 'Deine Freigabe wartet auf den nächsten Verarbeitungslauf.',
    failed: 'Der letzte Versuch ist fehlgeschlagen. Prüfe bitte deinen Usernamen und versuche es erneut.',
  },
}

export default async function RaidMapAccountPage({ lang }: { lang: RaidMapLang }) {
  const { userId: clerkUserId } = await auth()
  const accountPath = lang === 'de' ? RAIDMAP_CONFIG.accountPathDe : RAIDMAP_CONFIG.accountPath
  const salesPath = lang === 'de' ? RAIDMAP_CONFIG.salesPathDe : RAIDMAP_CONFIG.salesPathEn
  const docsPath = lang === 'de' ? RAIDMAP_CONFIG.docsPathDe : RAIDMAP_CONFIG.docsPathEn

  // Dev-only test mode uses the same simulated account as the claim action.
  const userId = clerkUserId ?? (isRaidMapTestMode() ? RAIDMAP_TEST_USER_ID : null)
  if (!userId) {
    redirect(`/sign-in?redirect_url=${encodeURIComponent(accountPath)}`)
  }

  const [access, indicator, tvAccount] = await Promise.all([
    getRaidMapAccessState(userId),
    getRaidMapIndicator(),
    getTradingViewAccountForUser(userId),
  ])

  const claims = indicator ? await listIndicatorClaimsForUser(userId) : []
  const claim = indicator ? claims.find((item) => item.indicatorId === indicator.id) ?? null : null
  const hasGuideImage = fs.existsSync(path.join(process.cwd(), 'public', RAIDMAP_CONFIG.guideImagePath))
  const t = copy[lang]
  const statuses = claimStatusCopy[lang]

  return (
    <div className="bg-white px-4 py-16 md:px-6">
      <div className="container mx-auto max-w-3xl">
        <h1 className="text-balance text-3xl font-bold text-gray-900 md:text-4xl">
          {t.heading}
        </h1>

        <section className="mt-10 rounded-xl border border-gray-200 p-7">
          <h2 className="text-lg font-bold text-gray-900">{t.subscriptionTitle}</h2>
          {access.hasAccess ? (
            <p className="mt-2 text-pretty text-gray-600">
              <Check className="mr-1 inline size-4 text-blue-600" />
              {t.active} ({access.tier === 'annual' ? t.annualPlan : t.monthlyPlan}
              {access.status === 'trialing' ? ` · ${t.freeTrial}` : ''}).
            </p>
          ) : (
            <p className="mt-2 text-pretty text-gray-600">
              {t.noSubscription}{' '}
              <Link href={`${salesPath}#pricing`} className="text-blue-700 underline underline-offset-4">
                {t.plansLink}
              </Link>
              . {t.refreshHint}
            </p>
          )}
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <ManageSubscriptionButton
              label={t.manageSubscription}
              loadingLabel={lang === 'de' ? 'Wird geöffnet…' : 'Opening…'}
              errorTitle={lang === 'de' ? 'Fehler' : 'Error'}
              fallbackErrorMessage={
                lang === 'de'
                  ? 'Das Zahlungsportal konnte nicht geöffnet werden.'
                  : 'Could not open the billing portal.'
              }
              endpoint={`/api/raidmap-portal?lang=${lang}`}
            />
            <Button asChild variant="ghost">
              <Link href={docsPath}>{t.documentation}</Link>
            </Button>
          </div>
          <p className="mt-3 text-pretty text-xs text-gray-400">{t.portalHint}</p>
        </section>

        <section className="mt-8 rounded-xl border border-gray-200 p-7">
          <h2 className="text-lg font-bold text-gray-900">{t.tradingViewTitle}</h2>
          {access.hasAccess ? (
            <>
              <p className="mt-2 text-pretty text-gray-600">{t.tradingViewActive}</p>
              {claim ? (
                <p className="mt-3 text-pretty text-sm text-gray-700">
                  <span className="font-semibold">@{claim.tvUsername}</span> ·{' '}
                  {statuses[claim.status] ?? `${t.statusFallback}: ${claim.status}`}
                </p>
              ) : null}
              <div className="mt-4">
                <TvUsernameForm
                  initialUsername={claim?.tvUsername ?? tvAccount?.tvUsername ?? ''}
                  lang={lang}
                />
              </div>
            </>
          ) : (
            <p className="mt-2 text-pretty text-gray-600">{t.tradingViewInactive}</p>
          )}
        </section>

        <section className="mt-8 rounded-xl border border-gray-200 p-7">
          <h2 className="text-lg font-bold text-gray-900">{t.findTitle}</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-gray-600">
            {t.findSteps.map((step) => (
              <li key={step} className="text-pretty">{step}</li>
            ))}
          </ol>
          {hasGuideImage ? (
            <div className="mt-5 overflow-hidden rounded-lg border border-gray-200">
              <Image
                src={RAIDMAP_CONFIG.guideImagePath}
                alt={t.imageAlt}
                width={1630}
                height={1316}
                sizes="(max-width: 768px) 100vw, 672px"
                className="h-auto w-full"
              />
            </div>
          ) : null}
          <p className="mt-4 text-pretty text-sm text-gray-500">
            {t.questions}{' '}
            <a href="mailto:kontakt@price-action-trader.de" className="underline underline-offset-4">
              kontakt@price-action-trader.de
            </a>
          </p>
        </section>

        <section className="mt-8 rounded-xl border border-gray-200 p-7">
          <h2 className="text-lg font-bold text-gray-900">{t.experienceTitle}</h2>
          {access.hasAccess ? (
            <>
              <p className="mt-2 text-pretty text-gray-600">{t.experienceActive}</p>
              <div className="mt-4">
                <TestimonialForm lang={lang} />
              </div>
            </>
          ) : (
            <p className="mt-2 text-pretty text-gray-600">{t.experienceInactive}</p>
          )}
        </section>
      </div>
    </div>
  )
}
