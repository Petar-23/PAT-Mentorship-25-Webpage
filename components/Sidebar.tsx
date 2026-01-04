'use client'
import dynamic from 'next/dynamic'
import { SidebarUser } from './sidebar-user'
import { useMediaQuery } from '@/hooks/use-media-query'

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

type Props = {
  kurse: Kurs[]
  savedSidebarOrder?: string[] | null
  activeCourseId?: string | null
  isAdmin: boolean
  openCreateCourseModal?: boolean
}

export function Sidebar({ kurse, savedSidebarOrder, activeCourseId, isAdmin, openCreateCourseModal }: Props) {
  const isDesktop = useMediaQuery('(min-width: 1024px)')
  const showAdminUi = isAdmin && isDesktop

  if (showAdminUi) {
    return (
      <SidebarAdmin
        kurse={kurse}
        savedSidebarOrder={savedSidebarOrder}
        activeCourseId={activeCourseId}
        isAdmin={isAdmin}
        openCreateCourseModal={openCreateCourseModal}
      />
    )
  }

  return <SidebarUser kurse={kurse} savedSidebarOrder={savedSidebarOrder} activeCourseId={activeCourseId} />
}