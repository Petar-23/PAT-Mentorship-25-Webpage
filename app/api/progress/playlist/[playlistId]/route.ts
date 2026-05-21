import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'

type RouteParams = {
  params: Promise<{ playlistId: string }>
}

function percent(completed: number, total: number) {
  if (!Number.isFinite(total) || total <= 0) return 0
  return Math.max(0, Math.min(100, Math.round((completed / total) * 100)))
}

export async function GET(_req: Request, { params }: RouteParams) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { playlistId } = await params
  if (!playlistId) return NextResponse.json({ error: 'Missing playlistId' }, { status: 400 })

  const [playlist, chapters, videoCountsByChapter, watchedRows] = await Promise.all([
    prisma.playlist.findUnique({
      where: { id: playlistId },
      select: {
        id: true,
        modules: {
          select: { id: true },
        },
      },
    }),
    prisma.chapter.findMany({
      where: { module: { playlistId } },
      select: { id: true, moduleId: true },
    }),
    prisma.video.groupBy({
      by: ['chapterId'],
      where: { chapter: { module: { playlistId } } },
      _count: { _all: true },
    }),
    prisma.videoProgress.findMany({
      where: {
        userId,
        watched: true,
        video: { chapter: { module: { playlistId } } },
      },
      select: {
        video: { select: { chapter: { select: { moduleId: true } } } },
      },
    }),
  ])

  if (!playlist) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const moduleIdByChapterId = new Map(chapters.map((chapter) => [chapter.id, chapter.moduleId]))
  const totalLessonsByModuleId = new Map<string, number>()
  const completedLessonsByModuleId = new Map<string, number>()

  for (const row of videoCountsByChapter) {
    const moduleId = moduleIdByChapterId.get(row.chapterId)
    if (!moduleId) continue
    totalLessonsByModuleId.set(
      moduleId,
      (totalLessonsByModuleId.get(moduleId) ?? 0) + (row._count._all ?? 0)
    )
  }

  for (const row of watchedRows) {
    const moduleId = row.video.chapter.moduleId
    completedLessonsByModuleId.set(moduleId, (completedLessonsByModuleId.get(moduleId) ?? 0) + 1)
  }

  const modules: Record<
    string,
    { totalLessons: number; completedLessons: number; percent: number }
  > = {}

  for (const moduleRow of playlist.modules) {
    const totalLessons = totalLessonsByModuleId.get(moduleRow.id) ?? 0
    const completedLessons = completedLessonsByModuleId.get(moduleRow.id) ?? 0
    modules[moduleRow.id] = {
      totalLessons,
      completedLessons,
      percent: percent(completedLessons, totalLessons),
    }
  }

  return NextResponse.json({ playlistId, modules })
}
