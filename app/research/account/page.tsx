import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight } from '@/components/mentorship/icons'
import { ManageBillingButton } from '@/components/research/manage-billing-button'
import { getResearchRequestContext } from '@/lib/research/request-context'
import { researchHref } from '@/lib/research/routing.mjs'
import { describeResearchMembership } from '@/lib/research/ui.mjs'
import { requireResearchSignedIn } from '@/lib/research/viewer'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Account',
}

export default async function ResearchAccountPage() {
  const viewer = await requireResearchSignedIn('/account')
  const { basePath } = await getResearchRequestContext()
  const membership = describeResearchMembership(viewer.access)
  const details = [
    membership.plan ? { label: 'Plan', value: membership.plan } : null,
    membership.interval ? { label: 'Billing', value: membership.interval } : null,
    membership.dateLabel && membership.date ? { label: membership.dateLabel, value: membership.date } : null,
  ].filter((detail): detail is { label: string; value: string } => detail !== null)
  const showBilling = membership.hasSubscription && !membership.isTest
  // Open past_due subscription: fix the payment in the portal instead of
  // subscribing again (checkout would answer already_subscribed).
  const showPricing = !viewer.isMember && !(showBilling && membership.needsPaymentUpdate)

  return (
    <div className="m-page">
      <div className="m-page-header"><div>
        <p className="m-eyebrow">Account</p>
        <h1 className="m-page-title">Your membership</h1>
        {viewer.email ? <p className="m-page-intro">Signed in as <span className="r-email">{viewer.email}</span></p> : null}
      </div></div>

      <div className="r-narrow">
        <section className="r-card" aria-labelledby="research-membership-heading">
          <div className="r-card-head">
            <h2 id="research-membership-heading">PAT Research</h2>
            <span className="r-status" data-state={membership.state}>{membership.status}</span>
          </div>
          {membership.detail ? <p className="r-card-detail">{membership.detail}</p> : null}
          {membership.isTest ? <p className="r-test-badge">Test mode — simulated membership, no Stripe subscription.</p> : null}

          {details.length ? (
            <dl className="r-details">
              {details.map(detail => (
                <div key={detail.label}>
                  <dt>{detail.label}</dt>
                  <dd>{detail.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}

          <div className="r-card-actions">
            {showBilling ? (
              <ManageBillingButton label={membership.needsPaymentUpdate ? 'Update payment method' : 'Manage billing'} />
            ) : null}
            {showPricing ? (
              <Link href={researchHref(basePath, '/pricing')} prefetch={false}
                className={membership.hasSubscription ? 'm-text-link' : 'm-primary-link'}>
                {membership.hasSubscription ? 'See plans and pricing' : 'Choose a plan'}
                {membership.hasSubscription ? null : <ArrowRight aria-hidden="true" />}
              </Link>
            ) : null}
          </div>
          {showBilling ? (
            <p className="r-card-footnote">Billing opens Stripe’s secure customer portal, where you can change your plan, update your payment method, download invoices or cancel.</p>
          ) : null}
        </section>
      </div>
    </div>
  )
}
