'use client'

import Link from 'next/link'
import { ArrowRight } from '@/components/research/icons'
import { useResearchHref } from '@/components/research/base-path'

export default function ResearchNotFound() {
  const href = useResearchHref()

  return (
    <div className="m-page">
      <div className="r-narrow">
        <p className="m-eyebrow">404</p>
        <h1 className="m-page-title">Page not found</h1>
        <p className="m-page-intro">This page doesn&apos;t exist or has moved.</p>
        <div className="r-actions">
          <Link href={href('/')} prefetch={false} className="m-primary-link">Go to the research home<ArrowRight aria-hidden="true" /></Link>
        </div>
      </div>
    </div>
  )
}
