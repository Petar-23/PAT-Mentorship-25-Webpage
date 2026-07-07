import fs from 'fs'
import path from 'path'
import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'
import { Check } from '@phosphor-icons/react/dist/ssr/Check'
import { Button } from '@/components/ui/button'
import { ManageSubscriptionButton } from '@/components/ui/manage-subscription'
import { TvUsernameForm } from '@/components/sections/raidmap/tv-username-form'
import { listIndicatorClaimsForUser, getTradingViewAccountForUser } from '@/lib/indicators/store'
import { getRaidMapAccessState, getRaidMapIndicator } from '@/lib/raidmap-access'
import { RAIDMAP_CONFIG } from '@/lib/raidmap-config'
import { isRaidMapTestMode, RAIDMAP_TEST_USER_ID } from '@/lib/raidmap-test-mode'

export const metadata: Metadata = {
  title: 'PAT Raid Map — Your account',
  robots: { index: false },
}

export const dynamic = 'force-dynamic'

const claimStatusCopy: Record<string, string> = {
  granted: 'Access granted — the indicator is live on your TradingView account.',
  pending: 'Access request queued — usually processed within the hour.',
  processing: 'Access request is being processed right now.',
  needs_session: 'Queued — waiting for the access worker.',
  failed: 'The last attempt failed — please check your username and try again.',
}

export default async function RaidMapAccountPage() {
  const { userId: clerkUserId } = await auth()
  // Dev-only Test-Mode: ohne Clerk-Login mit simuliertem Test-User weiterarbeiten
  // (doppelt geguarded in lib/raidmap-test-mode.ts, in Production immer aus).
  const userId = clerkUserId ?? (isRaidMapTestMode() ? RAIDMAP_TEST_USER_ID : null)
  if (!userId) {
    redirect(`/sign-in?redirect_url=${encodeURIComponent(RAIDMAP_CONFIG.accountPath)}`)
  }

  const [access, indicator, tvAccount] = await Promise.all([
    getRaidMapAccessState(userId),
    getRaidMapIndicator(),
    getTradingViewAccountForUser(userId),
  ])

  const claims = indicator ? await listIndicatorClaimsForUser(userId) : []
  const claim = indicator ? claims.find((c) => c.indicatorId === indicator.id) ?? null : null
  const hasGuideImage = fs.existsSync(path.join(process.cwd(), 'public', RAIDMAP_CONFIG.guideImagePath))

  return (
    <main className="py-16 px-4 md:px-6 bg-white">
      <div className="container mx-auto max-w-3xl">
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 text-balance">
          PAT Raid Map — your account
        </h1>

        {/* Abo-Status */}
        <section className="mt-10 rounded-xl border border-gray-200 p-7">
          <h2 className="text-lg font-bold text-gray-900">Subscription</h2>
          {access.hasAccess ? (
            <p className="mt-2 text-gray-600 text-pretty">
              <Check className="inline size-4 text-blue-600 mr-1" />
              Active ({access.tier === 'annual' ? 'annual plan' : 'monthly plan'}
              {access.status === 'trialing' ? ' · free trial' : ''}).
            </p>
          ) : (
            <p className="mt-2 text-gray-600 text-pretty">
              No active Raid Map subscription on this account.{' '}
              <Link href={`${RAIDMAP_CONFIG.salesPathEn}#pricing`} className="text-blue-700 underline underline-offset-4">
                See plans
              </Link>
              . If you just purchased, this can take a minute — refresh shortly.
            </p>
          )}
          <div className="mt-4 flex flex-col sm:flex-row gap-3">
            <ManageSubscriptionButton label="Manage subscription & invoices" />
            <Button asChild variant="ghost">
              <Link href={RAIDMAP_CONFIG.docsPathEn}>Documentation</Link>
            </Button>
          </div>
          <p className="mt-3 text-xs text-gray-400 text-pretty">
            Cancel, switch plans, update payment details and download invoices in the billing portal.
          </p>
        </section>

        {/* TradingView-Zugang */}
        <section className="mt-8 rounded-xl border border-gray-200 p-7">
          <h2 className="text-lg font-bold text-gray-900">TradingView access</h2>
          {access.hasAccess ? (
            <>
              <p className="mt-2 text-gray-600 text-pretty">
                Access is granted to your TradingView username (a free TradingView account is enough).
              </p>
              {claim ? (
                <p className="mt-3 text-sm text-gray-700 text-pretty">
                  <span className="font-semibold">@{claim.tvUsername}</span> —{' '}
                  {claimStatusCopy[claim.status] ?? `status: ${claim.status}`}
                </p>
              ) : null}
              <div className="mt-4">
                <TvUsernameForm initialUsername={claim?.tvUsername ?? tvAccount?.tvUsername ?? ''} />
              </div>
            </>
          ) : (
            <p className="mt-2 text-gray-600 text-pretty">
              Access provisioning appears here once your subscription is active.
            </p>
          )}
        </section>

        {/* Wo finde ich den Indikator */}
        <section className="mt-8 rounded-xl border border-gray-200 p-7">
          <h2 className="text-lg font-bold text-gray-900">Where to find the indicator</h2>
          <ol className="mt-3 space-y-2 list-decimal pl-5 text-gray-600">
            <li className="text-pretty">Open any chart on TradingView and click “Indicators”.</li>
            <li className="text-pretty">
              In the left sidebar choose <span className="font-semibold">“Invite-only”</span>.
            </li>
            <li className="text-pretty">Select “PAT Raid Map” — done. It stays in your list.</li>
          </ol>
          {hasGuideImage ? (
            <div className="mt-5 overflow-hidden rounded-lg border border-gray-200">
              <Image
                src={RAIDMAP_CONFIG.guideImagePath}
                alt="TradingView indicators dialog with the Invite-only section highlighted"
                width={1630}
                height={1316}
                sizes="(max-width: 768px) 100vw, 672px"
                className="w-full h-auto"
              />
            </div>
          ) : null}
          <p className="mt-4 text-sm text-gray-500 text-pretty">
            Questions? <a href="mailto:kontakt@price-action-trader.de" className="underline underline-offset-4">kontakt@price-action-trader.de</a>
          </p>
        </section>
      </div>
    </main>
  )
}
