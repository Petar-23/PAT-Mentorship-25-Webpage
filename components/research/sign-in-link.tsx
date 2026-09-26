'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import { useResearchHref, useResearchLogicalPath } from '@/components/research/base-path'
import { researchSignInHref } from '@/lib/research/ui.mjs'

/**
 * "Sign in" link to the research sign-in page that returns to the current page
 * (or to `returnPath`, a logical research path such as "/pricing?tier=member").
 */
export function ResearchSignInLink({ returnPath, className, children = 'Sign in' }: {
  returnPath?: string
  className?: string
  children?: ReactNode
}) {
  const href = useResearchHref()
  const logicalPath = useResearchLogicalPath()

  return <Link href={researchSignInHref(href, returnPath ?? logicalPath)} prefetch={false} className={className}>{children}</Link>
}
