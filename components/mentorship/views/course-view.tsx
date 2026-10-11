import { learningPercent } from '@/lib/mentorship-learning'
// app/mentorship/[id]/page.tsx

import { prisma } from '@/lib/prisma'
import { Sidebar } from '@/components/Sidebar'
import { MentorshipModuleView } from './module-view'
import { ModuleGridClient } from '@/components/module-grid-client'
import { getSidebarData } from '@/lib/sidebar-data'


interface Props {
  id: string
  userId: string | null
  isAdmin: boolean
}



export async function MentorshipCourseView({ id, userId, isAdmin }: Props) {
  const sidebarDataPromise = getSidebarData()
  const kursPromise = prisma.playlist.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      description: true,
    },
  })
  const [{ kurseForSidebar, pagesForSidebar, savedSidebarOrder }, kurs] =
    await Promise.all([sidebarDataPromise, kursPromise])

  if (kurs) {
    // Es ist ein Kurs → Module-Grid
    // Schlank: Module + Kapitel-Count und Video-Dauer Summen (ohne alle Kapitel/Videos zu laden)
    const [modules, chapters, videoStatsByChapter, watchedProgressRows] =
      await Promise.all([
        prisma.module.findMany({
          where: { playlistId: kurs.id },
          orderBy: [{ order: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
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
          },
          _count: { _all: true },
          _sum: { duration: true },
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

    for (const row of videoStatsByChapter) {
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

    for (const row of videoStatsByChapter) {
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
          percent: learningPercent(completedLessons, totalLessons),
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
      <div className="m-workspace">
        <div className="m-desktop-sidebar hidden xl:block">
          <Sidebar
            kurse={kurseForSidebar}
            pages={pagesForSidebar}
            savedSidebarOrder={savedSidebarOrder}
            activeCourseId={kurs.id}
            isAdmin={isAdmin}
          />
        </div>

        <div className="m-page-scroll">

        <div className="flex flex-wrap gap-6 sm:gap-8 items-start">  {/* Neuer Flex-Wrapper: Module links breit, + rechts kompakt */}
            {/* 1. Alle Module: volle Breite */}
            <ModuleGridClient
              modules={modulesForGrid}
              playlistId={kurs.id}
              playlistName={kurs.name}
              playlistDescription={kurs.description}
              isAdmin={isAdmin}
              initialProgressByModuleId={!isAdmin && userId ? progressByModuleId : undefined}
            />

          </div>
        </div>
      </div>
    )
  }

  // Legacy module links use the same lesson renderer as /modul/[id].
  return <MentorshipModuleView id={id} userId={userId} isAdmin={isAdmin} />
}
