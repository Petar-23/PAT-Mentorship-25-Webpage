"use client"

import dynamic from "next/dynamic"
import { useState } from "react"
import { List } from "@phosphor-icons/react/List"
import { X } from "@phosphor-icons/react/X"
import { useMentorshipTheme } from "@/components/mentorship/shell"

import { Button } from "@/components/ui/button"
import { SlideOver, SlideOverContent, SlideOverTrigger } from "@/components/ui/slide-over"

const SidebarUser = dynamic(() => import("@/components/sidebar-user").then((mod) => mod.SidebarUser), {
  ssr: false,
  loading: () => (
    <div className="p-4 text-sm text-muted-foreground">
      Kurse werden geladen...
    </div>
  ),
})

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
}

export function MobileCoursesDrawer({
  kurse,
  pages = [],
  savedSidebarOrder,
  activeCourseId,
}: Props) {
  const [open, setOpen] = useState(false)
  const theme = useMentorshipTheme()

  return (
    <SlideOver open={open} onOpenChange={setOpen}>
      <SlideOverTrigger asChild>
        <Button variant="ghost" size="icon" className="m-menu-trigger" aria-label="Mentorship-Menü öffnen">
          <List className="h-5 w-5" aria-hidden="true" />
        </Button>
      </SlideOverTrigger>
      <SlideOverContent side="left" title="Mentorship-Menü" aria-describedby={undefined} data-theme={theme} overlayClassName="m-drawer-overlay"
        className={`mentorship-portal m-drawer ${theme === 'dark' ? 'dark' : ''}`}>
          <div className="m-drawer-header"><span>Deine Mentorship</span><button type="button" className="m-icon-button" aria-label="Menü schließen" onClick={() => setOpen(false)}><X aria-hidden="true" /></button></div>
          {open ? (
            <SidebarUser
              kurse={kurse}
              pages={pages.filter((page) => page.published)}
              savedSidebarOrder={savedSidebarOrder}
              activeCourseId={activeCourseId}
              onNavigate={() => setOpen(false)}
            />
          ) : null}
      </SlideOverContent>
    </SlideOver>
  )
}
