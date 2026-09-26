import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, CheckCircle } from '@/components/research/icons'
import { ResearchPricingClient } from '@/components/research/pricing-client'
import { getResearchRequestContext } from '@/lib/research/request-context'
import { researchHref } from '@/lib/research/routing.mjs'
import { firstSearchParam, parseResearchPlanSelection } from '@/lib/research/ui.mjs'
import { getResearchViewer } from '@/lib/research/viewer'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Pricing',
  description: 'Three prices, the same research. Pay monthly or annually and cancel anytime.',
}

type SearchParams = Record<string, string | string[] | undefined>

export default async function ResearchPricingPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const [viewer, { basePath }, params] = await Promise.all([getResearchViewer(), getResearchRequestContext(), searchParams])
  const selection = parseResearchPlanSelection(params)

  return (
    <div className="m-page">
      <div className="m-page-header"><div>
        <p className="m-eyebrow">Pricing</p>
        <h1 className="m-page-title">Pay what you can</h1>
        <p className="m-page-intro">Three prices, the same research. Choose monthly or annual billing and cancel anytime.</p>
      </div></div>

      {viewer.isMember ? (
        <section className="m-access-panel" aria-labelledby="research-member-heading">
          <div className="m-access-icon" aria-hidden="true"><CheckCircle /></div>
          <div className="m-access-copy">
            <h2 id="research-member-heading">You&apos;re already a member</h2>
            <p>Your membership unlocks all research. Billing and plan changes are in your account.</p>
          </div>
          <Link href={researchHref(basePath, '/account')} prefetch={false} className="m-primary-link">
            Go to your account<ArrowRight aria-hidden="true" />
          </Link>
        </section>
      ) : (
        <ResearchPricingClient signedIn={viewer.userId !== null} initialTier={selection.tier}
          initialInterval={selection.interval} checkoutCancelled={firstSearchParam(params.checkout) === 'cancelled'} />
      )}
    </div>
  )
}
