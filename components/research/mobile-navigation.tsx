'use client'

// Fork of components/mobile-courses-drawer.tsx for PAT Research: same reveal
// motion and swipe-to-close gesture, English labels, research navigation.
import { List, X } from '@/components/mentorship/icons'
import Image from 'next/image'
import { useRef, useSyncExternalStore, type PointerEvent } from 'react'
import { useResearchMobileNavigation, useResearchTheme } from '@/components/research/shell'
import { ResearchSidebar } from '@/components/research/sidebar'
import { Button } from '@/components/ui/button'
import { SlideOver, SlideOverContent, SlideOverTrigger } from '@/components/ui/slide-over'

type Props = {
  isMember: boolean
  signedIn: boolean
}

// Server-Snapshot false, Client-Snapshot true: React behält während der Hydration den
// Server-Wert und rendert danach mit true neu (wie useIsResearchSurface in base-path.tsx).
const subscribeToNothing = () => () => {}
const readMountedOnClient = () => true
const readUnmountedOnServer = () => false

export function ResearchMobileNavigation({ isMember, signedIn }: Props) {
  const { open, setOpen, container } = useResearchMobileNavigation()
  const theme = useResearchTheme()
  const swipe = useRef<{ pointerId: number; x: number; y: number; horizontal: boolean } | null>(null)
  const suppressSwipeClick = useRef(false)
  // The Radix dialog derives its ids (aria-controls) from useId, which differs between
  // the server render and hydration here because this element arrives as a server-created
  // prop slot. Until mounted, render the same trigger without the dialog; it is disabled
  // until the portal container exists anyway, so nothing changes for the visitor.
  const mounted = useSyncExternalStore(subscribeToNothing, readMountedOnClient, readUnmountedOnServer)

  function startSwipe(event: PointerEvent<HTMLDivElement>) {
    suppressSwipeClick.current = false
    swipe.current = event.isPrimary && event.button === 0
      ? { pointerId: event.pointerId, x: event.clientX, y: event.clientY, horizontal: false }
      : null
  }

  function moveSwipe(event: PointerEvent<HTMLDivElement>) {
    const start = swipe.current
    if (!start || start.pointerId !== event.pointerId) return
    const dx = event.clientX - start.x
    const dy = event.clientY - start.y
    if (!start.horizontal) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 12) return
      // Vertical scrolling stays with the browser; only horizontal movement is ours.
      if (Math.abs(dy) >= Math.abs(dx)) { swipe.current = null; return }
      start.horizontal = true
      event.currentTarget.setPointerCapture(event.pointerId)
    }
    event.preventDefault()
  }

  function endSwipe(event: PointerEvent<HTMLDivElement>) {
    const start = swipe.current
    if (!start || start.pointerId !== event.pointerId) return
    swipe.current = null
    if (!start.horizontal) return
    suppressSwipeClick.current = true
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    const dx = event.clientX - start.x
    const dy = event.clientY - start.y
    if (dx <= -56 && Math.abs(dx) > Math.abs(dy) * 1.3) setOpen(false)
  }

  if (!mounted) {
    return (
      <Button variant="ghost" size="icon" className="m-menu-trigger" aria-label="Open research menu" title="Open research menu" disabled>
        <List className="h-5 w-5" aria-hidden="true" />
      </Button>
    )
  }

  return (
    <SlideOver open={open} onOpenChange={setOpen}>
      <SlideOverTrigger asChild>
        <Button variant="ghost" size="icon" className="m-menu-trigger" aria-label="Open research menu" title="Open research menu" disabled={!container}>
          <List className="h-5 w-5" aria-hidden="true" />
        </Button>
      </SlideOverTrigger>
      <SlideOverContent container={container} side="left" title="Research menu" aria-describedby={undefined} data-theme={theme} overlayClassName="m-drawer-overlay"
        onPointerDownCapture={startSwipe} onPointerMoveCapture={moveSwipe} onPointerUpCapture={endSwipe}
        onPointerCancel={() => { swipe.current = null; suppressSwipeClick.current = false }}
        onKeyDownCapture={() => { suppressSwipeClick.current = false }}
        onDragStartCapture={(event) => { if (swipe.current) event.preventDefault() }}
        onClickCapture={(event) => {
          if (!suppressSwipeClick.current) return
          suppressSwipeClick.current = false
          event.preventDefault()
          event.stopPropagation()
        }}
        className={`mentorship-portal m-drawer research-drawer ${theme === 'dark' ? 'dark' : ''}`}>
          <div className="m-drawer-header">
            <span><Image src="/images/hero/PAT-logo.png" alt="" width={32} height={32} />Research</span>
            <button type="button" className="m-icon-button" aria-label="Close menu" title="Close menu" onClick={() => setOpen(false)}><X aria-hidden="true" /></button>
          </div>
          <ResearchSidebar isMember={isMember} signedIn={signedIn} onNavigate={() => setOpen(false)} />
      </SlideOverContent>
    </SlideOver>
  )
}
