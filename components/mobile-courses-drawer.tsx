"use client"

import { List, X } from '@/components/mentorship/icons'
import dynamic from 'next/dynamic'
import Image from 'next/image'
import { useRef, type PointerEvent } from 'react'
import { useMentorshipMobileNavigation, useMentorshipTheme } from "@/components/mentorship/shell"
import { SidebarUser } from "@/components/sidebar-user"

import { Button } from "@/components/ui/button"
import { SlideOver, SlideOverContent, SlideOverTrigger } from "@/components/ui/slide-over"

const SidebarAdmin = dynamic(() => import('./sidebar-admin').then(module => module.SidebarAdmin), { ssr: false })

type Kurs = {
  id: string
  name: string
  slug: string
  modulesLength: number
  description?: string | null
  iconUrl?: string | null
}

type Page = {
  id: string
  title: string
  slug: string
  description?: string | null
  iconUrl?: string | null
  published: boolean
}

type Props = {
  kurse: Kurs[]
  pages?: Page[]
  savedSidebarOrder?: string[] | null
  activeCourseId?: string | null
  isAdmin?: boolean
}

export function MobileCoursesDrawer({
  kurse,
  pages = [],
  savedSidebarOrder,
  activeCourseId,
  isAdmin = false,
}: Props) {
  const { open, setOpen, container } = useMentorshipMobileNavigation()
  const theme = useMentorshipTheme()
  const swipe = useRef<{ pointerId: number; x: number; y: number; horizontal: boolean } | null>(null)
  const suppressSwipeClick = useRef(false)

  function startSwipe(event: PointerEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).closest('.m-admin-drag')) return
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
      // Keep vertical scrolling with the browser; only horizontal movement is ours.
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

  return (
    <SlideOver open={open} onOpenChange={setOpen}>
      <SlideOverTrigger asChild>
        <Button variant="ghost" size="icon" className="m-menu-trigger" aria-label="Mentorship-Menü öffnen" title="Mentorship-Menü öffnen" disabled={!container}>
          <List className="h-5 w-5" aria-hidden="true" />
        </Button>
      </SlideOverTrigger>
      <SlideOverContent container={container} side="left" title="Mentorship-Menü" aria-describedby={undefined} data-theme={theme} overlayClassName="m-drawer-overlay"
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
        className={`mentorship-portal m-drawer ${theme === 'dark' ? 'dark' : ''}`}>
          <div className="m-drawer-header"><span><Image src="/images/hero/PAT-logo.png" alt="" width={32} height={32} />Mentorship</span><button type="button" className="m-icon-button" aria-label="Menü schließen" title="Menü schließen" onClick={() => setOpen(false)}><X aria-hidden="true" /></button></div>
          {isAdmin ? <SidebarAdmin kurse={kurse} pages={pages} savedSidebarOrder={savedSidebarOrder}
            activeCourseId={activeCourseId} isAdmin onNavigate={() => setOpen(false)} /> : (
            <SidebarUser kurse={kurse} pages={pages.filter(page => page.published)}
              savedSidebarOrder={savedSidebarOrder} activeCourseId={activeCourseId} onNavigate={() => setOpen(false)} />
          )}
      </SlideOverContent>
    </SlideOver>
  )
}
