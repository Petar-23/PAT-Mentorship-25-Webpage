import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight } from '@/components/research/icons'
import { ResearchSignInLink } from '@/components/research/sign-in-link'
import { getResearchRequestContext } from '@/lib/research/request-context'
import { researchHref } from '@/lib/research/routing.mjs'
import { getResearchViewer } from '@/lib/research/viewer'

export const dynamic = 'force-dynamic'

const points = [
  {
    title: 'Tested studies',
    text: 'Each study states the instrument, the period, the sample and the rules, followed by the charts and the resulting numbers.',
  },
  {
    title: 'Clearly labelled',
    text: 'Every note is marked as tested, in progress, or an ICT teaching that has not been tested yet — so you always know what was measured.',
  },
  {
    title: 'Same research on every plan',
    text: 'Choose the price that fits you. Every plan unlocks exactly the same notes.',
  },
]

export default async function ResearchHomePage() {
  const [viewer, { basePath }] = await Promise.all([getResearchViewer(), getResearchRequestContext()])

  if (viewer.isMember) {
    return (
      <div className="m-page">
        <div className="m-page-header"><div>
          <p className="m-eyebrow">Research</p>
          <h1 className="m-page-title">Latest research</h1>
        </div></div>
        <p className="m-dashboard-empty">No research notes published yet.</p>
      </div>
    )
  }

  return (
    <div className="m-page">
      <section className="r-hero" aria-labelledby="research-hero-title">
        <div className="r-hero-copy">
          <p className="m-eyebrow">Price Action Trader</p>
          <h1 id="research-hero-title" className="r-hero-title">PAT Research</h1>
          <p className="r-hero-lede">
            Tested studies of ICT concepts on NQ futures — method, charts and numbers. Plus clearly marked ICT teachings that are not tested yet.
          </p>
          <div className="r-actions">
            <Link href={researchHref(basePath, '/pricing')} prefetch={false} className="m-primary-link">
              See plans and pricing<ArrowRight aria-hidden="true" />
            </Link>
            {viewer.userId ? null : (
              <ResearchSignInLink returnPath="/" className="m-text-link">Already a member? Sign in</ResearchSignInLink>
            )}
          </div>
        </div>
        <div className="r-hero-art" aria-hidden="true">
          <Image src="/images/mentorship/market-focus.webp" alt="" fill sizes="420px" />
        </div>
      </section>

      <section className="r-points" aria-label="What you get">
        {points.map(point => (
          <div key={point.title} className="r-point">
            <h2>{point.title}</h2>
            <p>{point.text}</p>
          </div>
        ))}
      </section>

      <p className="r-disclaimer">Educational content only. Nothing on PAT Research is financial advice or a trading signal.</p>
    </div>
  )
}
