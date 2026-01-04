import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'

type RouteParams = {
  params: Promise<{ moduleId: string }>
}

function percent(completed: number, total: number) {
  if (!Number.isFinite(total) || total <= 0) return 0
  return Math.max(0, Math.min(100, Math.round((completed / total) * 100)))
}

export async function GET(_req: Request, { params }: RouteParams) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { moduleId } = await params
  if (!moduleId) return NextResponse.json({ error: 'Missing moduleId' }, { status: 400 })

  const moduleRow = await prisma.module.findUnique({
    where: { id: moduleId },
    select: {
      id: true,
      chapters: {
        select: {
          videos: { select: { id: true } },
        },
      },
    },
  })

  if (!moduleRow) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const videoIds = moduleRow.chapters.flatMap((ch) => ch.videos.map((v) => v.id))
  const totalLessons = videoIds.length

  if (totalLessons === 0) {
    return NextResponse.json({
      moduleId,
      totalLessons,
      completedLessons: 0,
      percent: 0,
      watchedVideoIds: [],
    })
  }

  const watchedRows = await prisma.videoProgress.findMany({
    where: {
      userId,
      watched: true,
      videoId: { in: videoIds },
    },
    select: { videoId: true },
  })

  const watchedVideoIds = watchedRows.map((r) => r.videoId)
  const completedLessons = watchedVideoIds.length

  return NextResponse.json({
    moduleId,
    totalLessons,
    completedLessons,
    percent: percent(completedLessons, totalLessons),
    watchedVideoIds,
  })
}


