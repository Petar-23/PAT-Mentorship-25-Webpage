'use client'
import dynamic from 'next/dynamic'
import { SidebarUser } from './sidebar-user'

const SidebarAdmin = dynamic(() => import('./sidebar-admin').then((m) => m.SidebarAdmin), {
  ssr: false,
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
}

export function Sidebar({ kurse, pages = [], savedSidebarOrder, activeCourseId, isAdmin, openCreateCourseModal }: Props) {
  if (isAdmin) {
    return (
      <SidebarAdmin
        kurse={kurse}
        pages={pages}
        savedSidebarOrder={savedSidebarOrder}
        activeCourseId={activeCourseId}
        isAdmin={isAdmin}
        openCreateCourseModal={openCreateCourseModal}
      />
    )
  }

  return <SidebarUser kurse={kurse} pages={pages.filter(p => p.published)} savedSidebarOrder={savedSidebarOrder} activeCourseId={activeCourseId} />
}
