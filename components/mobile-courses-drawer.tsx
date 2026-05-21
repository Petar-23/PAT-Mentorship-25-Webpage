"use client"

import dynamic from "next/dynamic"
import { useState } from "react"
import { ArrowLeft } from "@phosphor-icons/react/ArrowLeft"
import { BookOpen } from "@phosphor-icons/react/BookOpen"

import { Button } from "@/components/ui/button"
import { SlideOver, SlideOverContent } from "@/components/ui/slide-over"
import { cn } from "@/lib/utils"

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
  isAdmin: boolean
  openCreateCourseModal?: boolean
  variant?: "button" | "bottomBar" | "icon"
  className?: string
}

export function MobileCoursesDrawer({
  kurse,
  pages = [],
  savedSidebarOrder,
  activeCourseId,
  variant = "button",
  className,
}: Props) {
  const [open, setOpen] = useState(false)

  return (
    <div className={cn("lg:hidden", className)}>
      {variant === "bottomBar" ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-neutral-300/75 text-neutral-50 backdrop-blur supports-[backdrop-filter]:bg-neutral-300/60">
          <div className="mx-auto max-w-7xl px-4 pt-3 [padding-bottom:calc(env(safe-area-inset-bottom)+0.75rem)]">
            <Button
              variant="outline"
              className="w-full h-11 text-neutral-900 dark:text-neutral-50"
              onClick={() => setOpen(true)}
            >
              <BookOpen className="mr-2 h-4 w-4" />
              Kurse
            </Button>
          </div>
        </div>
      ) : variant === "icon" ? (
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 p-0 hover:bg-gray-200"
          onClick={() => setOpen(true)}
          aria-label="Kurse öffnen"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
      ) : (
        <Button variant="outline" className="w-full h-11" onClick={() => setOpen(true)}>
          <BookOpen className="mr-2 h-4 w-4" />
          Kurse
        </Button>
      )}

      <SlideOver open={open} onOpenChange={setOpen}>
        <SlideOverContent side="left" title="Kurse" className="p-0 w-screen max-w-none">
          {open ? (
            <SidebarUser
              kurse={kurse}
              pages={pages.filter((page) => page.published)}
              savedSidebarOrder={savedSidebarOrder}
              activeCourseId={activeCourseId}
            />
          ) : null}
        </SlideOverContent>
      </SlideOver>
    </div>
  )
}
