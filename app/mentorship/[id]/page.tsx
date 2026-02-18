// app/mentorship/[id]/page.tsx

import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import { Sidebar } from '@/components/Sidebar'
import { ModulDetailClient } from '@/components/modul-detail-client'
import { ModuleGridClient } from '@/components/module-grid-client'
import { getIsAdmin } from '@/lib/authz'
import { MobileCoursesDrawer } from '@/components/mobile-courses-drawer'
import { auth } from '@clerk/nextjs/server'
import { getSidebarData } from '@/lib/sidebar-data'


interface Props {
  params: Promise<{ id: string }>
}

function percent(completed: number, total: number) {
  if (!Number.isFinite(total) || total <= 0) return 0
  return Math.max(0, Math.min(100, Math.round((completed / total) * 100)))
}

export default async function DynamicCoursePage({ params }: Props) {
  const { id } = await params
  const isAdmin = await getIsAdmin()
  const { userId } = await auth()

  // Sidebar-Daten — shared cached helper (deduplicated across routes per request)
  const { kurseForSidebar, savedSidebarOrder } = await getSidebarData()

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
    const [modules, chapters, chapterDurationSums, videoCountsByChapter, watchedProgressRows] =
      await Promise.all([
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
      // Für Progress: Anzahl Videos pro Kapitel (daraus pro Modul summieren)
      prisma.video.groupBy({
        by: ['chapterId'],
        where: {
          chapter: { module: { playlistId: kurs.id } },
        },
        _count: { _all: true },
      }),
      // Für Progress: nur "watched" Rows laden (deutlich weniger als alle Video-IDs)
      !isAdmin && userId
        ? prisma.videoProgress.findMany({
            where: {
              userId,
              watched: true,
              video: { chapter: { module: { playlistId: kurs.id } } },
            },
            select: {
              video: { select: { chapter: { select: { moduleId: true } } } },
            },
          })
        : Promise.resolve([]),
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

    // Progress Map: { [moduleId]: { totalLessons, completedLessons, percent } }
    const totalLessonsByModuleId: Record<string, number> = {}
    const completedLessonsByModuleId: Record<string, number> = {}

    for (const m of modules) {
      totalLessonsByModuleId[m.id] = 0
      completedLessonsByModuleId[m.id] = 0
    }

    for (const row of videoCountsByChapter) {
      const moduleId = moduleIdByChapterId.get(row.chapterId)
      if (!moduleId) continue
      totalLessonsByModuleId[moduleId] =
        (totalLessonsByModuleId[moduleId] ?? 0) + (row._count._all ?? 0)
    }

    for (const row of watchedProgressRows as Array<{ video: { chapter: { moduleId: string } } }>) {
      const moduleId = row.video.chapter.moduleId
      completedLessonsByModuleId[moduleId] = (completedLessonsByModuleId[moduleId] ?? 0) + 1
    }

    const progressByModuleId: Record<
      string,
      { totalLessons: number; completedLessons: number; percent: number }
    > = {}

    if (!isAdmin && userId) {
      for (const m of modules) {
        const totalLessons = totalLessonsByModuleId[m.id] ?? 0
        const completedLessons = completedLessonsByModuleId[m.id] ?? 0
        progressByModuleId[m.id] = {
          totalLessons,
          completedLessons,
          percent: percent(completedLessons, totalLessons),
        }
      }
    }

    const modulesForGrid = modules.map((m) => {
      const chapterCount = m._count.chapters
      const totalSeconds = durationByModuleId[m.id] ?? 0
      return {
        id: m.id,
        name: m.name,
        description: m.description ?? null,
        imageUrl: m.imageUrl ?? null,
        // Performance: Client braucht nur die Anzahl, kein Dummy-Array (spart JSON/JS).
        chaptersCount: chapterCount,
        totalDurationSeconds: totalSeconds > 0 ? totalSeconds : null,
      }
    })

    return (
      <div className="flex h-full min-h-0 bg-background">
        <div className="hidden lg:block">
          <Sidebar
            kurse={kurseForSidebar}
            savedSidebarOrder={savedSidebarOrder}
            activeCourseId={kurs.id}
            isAdmin={isAdmin}
          />
        </div>

        <div className="flex-1 p-4 sm:p-6 lg:p-8 pb-[calc(1.5rem+env(safe-area-inset-bottom))] lg:pb-8">

        <div className="flex flex-wrap gap-6 sm:gap-8 items-start">  {/* Neuer Flex-Wrapper: Module links breit, + rechts kompakt */}
            {/* 1. Alle Module: volle Breite */}
            <ModuleGridClient 
              modules={modulesForGrid}
              playlistId={kurs.id}
              playlistName={kurs.name}
              isAdmin={isAdmin}
              initialProgressByModuleId={!isAdmin && userId ? progressByModuleId : undefined}
              mobileCoursesDrawer={
                <MobileCoursesDrawer
                  variant="icon"
                  kurse={kurseForSidebar}
                  savedSidebarOrder={savedSidebarOrder}
                  activeCourseId={kurs.id}
                  isAdmin={isAdmin}
                />
              }
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

  // Performance: Fortschritt direkt serverseitig laden → kein extra Client-Fetch nötig.
  const initialWatchedVideoIds =
    !isAdmin && userId && allVideos.length
      ? (
          await prisma.videoProgress.findMany({
            where: {
              userId,
              watched: true,
              videoId: { in: allVideos.map((v) => v.id) },
            },
            select: { videoId: true },
          })
        ).map((r) => r.videoId)
      : []

  return (
    <div className="flex h-full min-h-0 bg-background">
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
        initialWatchedVideoIds={initialWatchedVideoIds}
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