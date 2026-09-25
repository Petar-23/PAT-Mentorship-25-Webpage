'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { useResearchHref } from '@/components/research/base-path'

// Error boundary for research pages (rendered inside the research shell).
// Server errors reach the browser without their class or message (only a digest),
// so ResearchAccessUnavailableError from lib/research/viewer.ts cannot be told
// apart here. It is the expected cause in practice (membership status could not be
// loaded), so the copy covers that case without claiming anything more specific.
export default function ResearchError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const router = useRouter()
  const href = useResearchHref()
  const [retrying, startRetry] = useTransition()

  function retry() {
    // Server components only render again after a refresh; reset() then clears the boundary.
    startRetry(() => {
      router.refresh()
      reset()
    })
  }

  return (
    <div className="m-page">
      <div className="r-narrow">
        <p className="m-eyebrow">Error</p>
        <h1 className="m-page-title">This page could not be loaded</h1>
        <p className="m-page-intro">Your membership status is temporarily unavailable. Please try again in a moment.</p>
        <div className="r-actions">
          <button type="button" className="r-button" onClick={retry} disabled={retrying} aria-busy={retrying || undefined}>
            Try again
          </button>
          <Link href={href('/')} prefetch={false} className="r-button" data-variant="secondary">Go to the research home</Link>
        </div>
        {error.digest ? <p className="r-small-print">Reference: {error.digest}</p> : null}
      </div>
    </div>
  )
}
