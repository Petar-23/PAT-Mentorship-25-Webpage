// app/mentorship/[id]/page.tsx

import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import { Sidebar } from '@/components/Sidebar'
import { ModulDetailClient } from '@/components/modul-detail-client'
import { ModuleGridClient } from '@/components/module-grid-client'
import { getIsAdmin } from '@/lib/authz'
import { MobileCoursesDrawer } from '@/components/mobile-courses-drawer'


interface Props {
  params: Promise<{ id: string }>
}

export default async function DynamicCoursePage({ params }: Props) {
  const { id } = await params
  const isAdmin = await getIsAdmin()

  // Sidebar-Daten (für beide Pfade) – schlank: nur Count statt ganze Module laden
  const [kurseRaw, savedSetting] = await Promise.all([
    prisma.playlist.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        iconUrl: true,
        _count: { select: { modules: true } },
      },
    }),
    prisma.adminSetting.findUnique({
      where: { key: 'sidebarOrder' },
    }),
  ])

  const kurseForSidebar = kurseRaw.map((k) => ({
    id: k.id,
    name: k.name,
    slug: k.slug,
    description: k.description ?? null,
    iconUrl: k.iconUrl ?? null,
    modulesLength: k._count.modules,
  }))

  const savedSidebarOrder: string[] | null = savedSetting ? (savedSetting.value as string[]) : null

  // Erst prüfen: Ist das ID eine Playlist (Kurs)?
  const kurs = await prisma.playlist.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
    },
  })

  if (kurs) {
    // Es ist ein Kurs → Module-Grid
    // Schlank: Module + Kapitel-Count und Video-Dauer Summen (ohne alle Kapitel/Videos zu laden)
    const [modules, chapters, chapterDurationSums] = await Promise.all([
      prisma.module.findMany({
        where: { playlistId: kurs.id },
        orderBy: { order: 'asc' },
        select: {
          id: true,
          name: true,
          description: true,
          imageUrl: true,
          _count: { select: { chapters: true } },
        },
      }),
      prisma.chapter.findMany({
        where: { module: { playlistId: kurs.id } },
        select: { id: true, moduleId: true },
      }),
      prisma.video.groupBy({
        by: ['chapterId'],
        where: {
          chapter: { module: { playlistId: kurs.id } },
          duration: { not: null },
        },
        _sum: { duration: true },
      }),
    ])

    const moduleIdByChapterId = new Map(chapters.map((c) => [c.id, c.moduleId]))
    const durationByModuleId: Record<string, number> = {}

    for (const m of modules) durationByModuleId[m.id] = 0

    for (const row of chapterDurationSums) {
      const moduleId = moduleIdByChapterId.get(row.chapterId)
      if (!moduleId) continue
      const seconds = row._sum.duration ?? 0
      durationByModuleId[moduleId] = (durationByModuleId[moduleId] ?? 0) + seconds
    }

    const modulesForGrid = modules.map((m) => {
      const chapterCount = m._count.chapters
      const totalSeconds = durationByModuleId[m.id] ?? 0
      return {
        id: m.id,
        name: m.name,
        description: m.description ?? null,
        imageUrl: m.imageUrl ?? null,
        // Client braucht aktuell nur `chapters.length` – wir schicken daher nur ein Dummy-Array.
        chapters: Array.from({ length: chapterCount }, () => ({ length: chapterCount })),
        totalDurationSeconds: totalSeconds > 0 ? totalSeconds : null,
      }
    })

    return (
      <div className="flex min-h-screen bg-background">
        <div className="hidden lg:block">
          <Sidebar
            kurse={kurseForSidebar}
            savedSidebarOrder={savedSidebarOrder}
            activeCourseId={kurs.id}
            isAdmin={isAdmin}
          />
        </div>

        <div className="flex-1 p-4 sm:p-6 lg:p-8 pb-[calc(5rem+env(safe-area-inset-bottom))] lg:pb-8">
          <MobileCoursesDrawer
            variant="bottomBar"
            kurse={kurseForSidebar}
            savedSidebarOrder={savedSidebarOrder}
            activeCourseId={kurs.id}
            isAdmin={isAdmin}
          />

        <div className="flex flex-wrap gap-6 sm:gap-8 items-start">  {/* Neuer Flex-Wrapper: Module links breit, + rechts kompakt */}
            {/* 1. Alle Module: volle Breite */}
            <ModuleGridClient 
              modules={modulesForGrid}
              playlistId={kurs.id}
              playlistName={kurs.name}
              isAdmin={isAdmin}
            />
            
          </div>
        </div>
      </div>
    )
  }

  // Wenn nicht Kurs → prüfe, ob es ein Modul ist
  const modul = await prisma.module.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      playlist: {
        select: {
          id: true,
          name: true,
        },
      },
      chapters: {
        orderBy: { order: 'asc' },
        select: {
          id: true,
          name: true,
          order: true,
          videos: {
            orderBy: { order: 'asc' },
            select: {
              id: true,
              title: true,
              bunnyGuid: true,
              pdfUrl: true,
              order: true,
            },
          },
        },
      },
    },
  })

  if (!modul) notFound()

  const allVideos = modul.chapters.flatMap((ch) => ch.videos)
  const initialVideoId =
    allVideos.find((v) => v.bunnyGuid !== null)?.id ?? allVideos[0]?.id ?? null

  return (
    <div className="flex min-h-screen bg-background">
      <div className="hidden lg:block">
        <Sidebar
          kurse={kurseForSidebar}
          savedSidebarOrder={savedSidebarOrder}
          activeCourseId={modul.playlist?.id ?? null}
          isAdmin={isAdmin}
        />
      </div>
      <ModulDetailClient
        modul={modul}
        initialVideoId={initialVideoId}
        isAdmin={isAdmin}
        sidebar={{
          kurse: kurseForSidebar,
          savedSidebarOrder,
          activeCourseId: modul.playlist?.id ?? null,
        }}
      />
    </div>
  )
}