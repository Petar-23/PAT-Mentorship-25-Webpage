'use client'

import Link, { useLinkStatus } from 'next/link'
import { useRouter } from 'next/navigation'
import type { ComponentProps } from 'react'

function NavigationHint() {
  const { pending } = useLinkStatus()
  return <span className="m-link-hint" data-pending={pending} aria-hidden="true" />
}

export function MentorshipLink({ href, children, className, onMouseEnter, onFocus, onTouchStart, prefetch = false, ...props }: ComponentProps<typeof Link>) {
  const router = useRouter()
  const prepareDestination = () => {
    if (typeof href === 'string' && href.startsWith('/mentorship')) router.prefetch(href)
  }

  return <Link {...props} href={href} prefetch={prefetch} className={`m-navigation-link ${className ?? ''}`}
    onMouseEnter={event => { onMouseEnter?.(event); if (!event.defaultPrevented) prepareDestination() }}
    onFocus={event => { onFocus?.(event); if (!event.defaultPrevented) prepareDestination() }}
    onTouchStart={event => { onTouchStart?.(event); if (!event.defaultPrevented) prepareDestination() }}>
    {children}
    <NavigationHint />
  </Link>
}
