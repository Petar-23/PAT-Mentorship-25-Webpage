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

export type SidebarPage = {
  id: string
  title: string
  slug: string
  description: string | null
  iconUrl: string | null
  published: boolean
}

export type SidebarData = {
  kurseForSidebar: SidebarKurs[]
  pagesForSidebar: SidebarPage[]
  savedSidebarOrder: string[] | null
}

export const getSidebarData = cache(async (): Promise<SidebarData> => {
  const [kurse, pages, savedSetting] = await Promise.all([
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
    prisma.page.findMany({
      select: {
        id: true,
        title: true,
        slug: true,
        description: true,
        iconUrl: true,
        published: true,
      },
      orderBy: [{ order: 'asc' }, { createdAt: 'desc' }],
    }).catch(() => [] as any[]),
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

  const pagesForSidebar: SidebarPage[] = pages.map((page) => ({
    id: page.id,
    title: page.title,
    slug: page.slug,
    description: page.description ?? null,
    iconUrl: page.iconUrl ?? null,
    published: page.published,
  }))

  const savedSidebarOrder: string[] | null = savedSetting ? (savedSetting.value as string[]) : null

  return { kurseForSidebar, pagesForSidebar, savedSidebarOrder }
})
