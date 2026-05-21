// lib/sidebar-data.ts
// Shared sidebar data fetcher — cached per request and briefly across requests.
// Admin mutations call revalidateSidebarData() so navigation does not keep stale sidebars.

import 'server-only'
import { cache } from 'react'
import { revalidateTag, unstable_cache } from 'next/cache'
import { prisma, withPrismaRetry } from '@/lib/prisma'

export const SIDEBAR_DATA_CACHE_TAG = 'mentorship-sidebar-data'

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

async function loadSidebarData(): Promise<SidebarData> {
  const [kurse, pages, savedSetting] = await withPrismaRetry(
    () =>
      Promise.all([
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
          select: { value: true },
        }),
      ]),
    { label: 'Load sidebar data' }
  )

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
}

const getCachedSidebarData = unstable_cache(
  loadSidebarData,
  [SIDEBAR_DATA_CACHE_TAG],
  {
    revalidate: 60,
    tags: [SIDEBAR_DATA_CACHE_TAG],
  }
)

export const getSidebarData = cache(() => getCachedSidebarData())

export function revalidateSidebarData() {
  revalidateTag(SIDEBAR_DATA_CACHE_TAG, { expire: 0 })
}
