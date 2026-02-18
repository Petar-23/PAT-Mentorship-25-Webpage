// lib/sidebar-data.ts
// Shared sidebar data fetcher — cached per request via React cache()
// Eliminates duplicate DB queries across mentorship routes.

import 'server-only'
import { cache } from 'react'
import { prisma } from '@/lib/prisma'

export type SidebarKurs = {
  id: string
  name: string
  slug: string
  description: string | null
  iconUrl: string | null
  modulesLength: number
}

export type SidebarData = {
  kurseForSidebar: SidebarKurs[]
  savedSidebarOrder: string[] | null
}

export const getSidebarData = cache(async (): Promise<SidebarData> => {
  const [kurse, savedSetting] = await Promise.all([
    prisma.playlist.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        iconUrl: true,
        _count: { select: { modules: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.adminSetting.findUnique({
      where: { key: 'sidebarOrder' },
    }),
  ])

  const kurseForSidebar: SidebarKurs[] = kurse.map((kurs) => ({
    id: kurs.id,
    name: kurs.name,
    slug: kurs.slug,
    description: kurs.description ?? null,
    iconUrl: kurs.iconUrl ?? null,
    modulesLength: kurs._count.modules,
  }))

  const savedSidebarOrder: string[] | null = savedSetting ? (savedSetting.value as string[]) : null

  return { kurseForSidebar, savedSidebarOrder }
})
