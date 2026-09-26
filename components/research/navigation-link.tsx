'use client'

import Link, { useLinkStatus } from 'next/link'
import { useRouter } from 'next/navigation'
import type { ComponentProps } from 'react'

// Research-Fork von components/mentorship/navigation-link.tsx: gleiche Optik und
// Pending-Hinweis, aber Vorladen für interne Research-Links (Host- wie Pfad-
// Modus). Eigene Datei, damit Research und Mentorship keinen Chunk teilen müssen.

function NavigationHint() {
  const { pending } = useLinkStatus()
  return <span className="m-link-hint" data-pending={pending} aria-hidden="true" />
}

export function ResearchLink({ href, children, className, onMouseEnter, onFocus, onTouchStart, prefetch = false, ...props }: ComponentProps<typeof Link>) {
  const router = useRouter()
  const prepareDestination = () => {
    // Nur app-relative Ziele (die Sidebar baut sie über useResearchHref).
    if (typeof href === 'string' && href.startsWith('/') && !href.startsWith('//')) router.prefetch(href)
  }

  return <Link {...props} href={href} prefetch={prefetch} className={`m-navigation-link ${className ?? ''}`}
    onMouseEnter={event => { onMouseEnter?.(event); if (!event.defaultPrevented) prepareDestination() }}
    onFocus={event => { onFocus?.(event); if (!event.defaultPrevented) prepareDestination() }}
    onTouchStart={event => { onTouchStart?.(event); if (!event.defaultPrevented) prepareDestination() }}>
    {children}
    <NavigationHint />
  </Link>
}
