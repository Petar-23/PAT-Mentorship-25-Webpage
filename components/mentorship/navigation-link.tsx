'use client'

import Link, { useLinkStatus } from 'next/link'
import { useRouter } from 'next/navigation'
import type { ComponentProps } from 'react'
import { useCustomerPreview } from './customer-preview-context'
import { customerPreviewHref } from '@/lib/customer-preview-policy'

function NavigationHint() {
  const { pending } = useLinkStatus()
  return <span className="m-link-hint" data-pending={pending} aria-hidden="true" />
}

export function MentorshipLink({ href, children, className, onMouseEnter, onFocus, onTouchStart, prefetch = false, ...props }: ComponentProps<typeof Link>) {
  const router = useRouter()
  const preview = useCustomerPreview()
  const destination = preview ? typeof href === 'string' ? customerPreviewHref(href, preview.id) : null : href
  const prepareDestination = () => {
    if (!preview && typeof href === 'string' && href.startsWith('/mentorship')) router.prefetch(href)
  }

  if (destination === null) return <span role="link" aria-disabled="true" className={`${className ?? ''} m-preview-disabled`}
    title="In der Kundenvorschau nicht verfügbar">{children}</span>

  return <Link {...props} href={destination} prefetch={preview ? false : prefetch} className={`m-navigation-link ${className ?? ''}`}
    onMouseEnter={event => { onMouseEnter?.(event); if (!event.defaultPrevented) prepareDestination() }}
    onFocus={event => { onFocus?.(event); if (!event.defaultPrevented) prepareDestination() }}
    onTouchStart={event => { onTouchStart?.(event); if (!event.defaultPrevented) prepareDestination() }}>
    {children}
    <NavigationHint />
  </Link>
}
