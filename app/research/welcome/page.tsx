import type { Metadata } from 'next'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { ArrowClockwise } from '@phosphor-icons/react/dist/ssr/ArrowClockwise'
import { CheckCircle, WarningCircle } from '@/components/mentorship/icons'
import { ResearchRefreshOnMount } from '@/components/research/refresh-on-mount'
import { consumeResearchRateLimit } from '@/lib/research/rate-limit'
import { getResearchRequestContext } from '@/lib/research/request-context'
import { researchHref } from '@/lib/research/routing.mjs'
import { describeResearchErrorForLog, isResearchStripeError, syncResearchCheckoutSessionForUser } from '@/lib/research/stripe'
import { isResearchTestMode } from '@/lib/research/test-mode'
import {
  RESEARCH_WELCOME_SYNC_RATE_LIMIT,
  firstSearchParam,
  isCheckoutSessionId,
  resolveResearchWelcomeState,
  type ResearchWelcomeState,
} from '@/lib/research/ui.mjs'
import { requireResearchSignedIn } from '@/lib/research/viewer'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Welcome',
}

type SearchParams = Record<string, string | string[] | undefined>
type WelcomeState = ResearchWelcomeState

// Synchronisiert das Abo direkt nach dem Checkout (ohne auf den Webhook zu
// warten). Entscheidungslogik (Mitglied → kein Stripe-Aufruf, Rate-Limit pro
// User, nur echte Fehlschläge → 'failed') in resolveResearchWelcomeState.
// Fremde oder unbekannte Sessions ergeben nur eine allgemeine Meldung.
function resolveWelcomeState(sessionId: string | null, userId: string, isMember: boolean): Promise<WelcomeState> {
  return resolveResearchWelcomeState({
    sessionId,
    isMember,
    consumeRateLimit: () => consumeResearchRateLimit({ key: `welcome:${userId}`, ...RESEARCH_WELCOME_SYNC_RATE_LIMIT }),
    sync: (id) => syncResearchCheckoutSessionForUser({ sessionId: id, userId }),
    isForeignSession: (error) => isResearchStripeError(error, 'foreign_session'),
    onError: (stage, error) => {
      console.error(`Research welcome: checkout ${stage === 'sync' ? 'sync' : 'rate limit'} failed`, describeResearchErrorForLog(error))
    },
  })
}

export default async function ResearchWelcomePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams
  const rawSessionId = firstSearchParam(params.session_id)
  const sessionId = isCheckoutSessionId(rawSessionId) ? rawSessionId : null
  const viewer = await requireResearchSignedIn(sessionId ? `/welcome?session_id=${encodeURIComponent(sessionId)}` : '/welcome')
  const { basePath } = await getResearchRequestContext()
  const href = (path: string) => researchHref(basePath, path)

  const testPreview = firstSearchParam(params.test) === '1' && isResearchTestMode()
  const state: WelcomeState = testPreview ? 'active' : await resolveWelcomeState(sessionId, viewer.userId, viewer.isMember)
  const reloadHref = href(sessionId ? `/welcome?session_id=${encodeURIComponent(sessionId)}` : '/welcome')

  const content: Record<WelcomeState, { icon: ReactNode; eyebrow: string; title: string; body: ReactNode }> = {
    active: {
      icon: <CheckCircle />,
      eyebrow: 'Membership active',
      title: 'Welcome to PAT Research',
      body: <p className="m-page-intro">Your membership is active. Thank you for supporting independent, tested research.</p>,
    },
    pending: {
      icon: <ArrowClockwise size={24} weight="bold" focusable="false" />,
      eyebrow: 'Almost there',
      title: 'Confirming your payment',
      body: <>
        <p className="m-page-intro">Your payment is being confirmed — this usually takes a few seconds.</p>
        <p className="m-page-intro">If it still isn’t confirmed after a few minutes, check your account: your membership appears there as soon as the payment is confirmed.</p>
        <div className="r-actions">
          <a href={reloadHref} className="m-primary-link">Check again</a>
        </div>
      </>,
    },
    failed: {
      icon: <WarningCircle />,
      eyebrow: 'Checkout',
      title: 'We couldn’t confirm this checkout',
      body: <p className="m-page-intro">
        If you completed the payment, your membership will appear in your account within a few minutes.
        Otherwise you can start again from the pricing page.
      </p>,
    },
    missing: {
      icon: <WarningCircle />,
      eyebrow: 'Checkout',
      title: 'No checkout to confirm',
      body: <p className="m-page-intro">We couldn’t find a completed checkout for your account. You can choose a plan on the pricing page.</p>,
    },
  }
  const { icon, eyebrow, title, body } = content[state]

  return (
    <div className="m-page">
      {/* Access was granted during this request: refresh once so the layout's navigation matches. */}
      {state === 'active' && !viewer.isMember && !testPreview ? <ResearchRefreshOnMount /> : null}
      <div className="r-narrow">
        <div className="r-state-icon" data-state={state} aria-hidden="true">{icon}</div>
        <p className="m-eyebrow">{eyebrow}</p>
        <h1 className="m-page-title">{title}</h1>
        {testPreview ? <p className="r-test-badge">Test mode — no real payment was made.</p> : null}
        {body}

        <section className="r-steps" aria-labelledby="research-next-steps">
          <h2 id="research-next-steps">Next steps</h2>
          <ul>
            {state === 'active' || state === 'pending' ? (
              <li><Link href={href('/')} prefetch={false} className="m-content-row"><div>
                <h3>Go to the research home</h3>
                <p>New notes appear there as soon as they are published.</p>
              </div></Link></li>
            ) : (
              <li><Link href={href('/pricing')} prefetch={false} className="m-content-row"><div>
                <h3>View plans and pricing</h3>
                <p>Choose the price that fits you. Every plan unlocks the same research.</p>
              </div></Link></li>
            )}
            <li><Link href={href('/account')} prefetch={false} className="m-content-row"><div>
              <h3>Manage your membership</h3>
              <p>See your plan and renewal date, update your payment method or cancel.</p>
            </div></Link></li>
          </ul>
        </section>
      </div>
    </div>
  )
}
