import { learningPercent } from '@/lib/mentorship-learning'
import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'

type RouteParams = {
  params: Promise<{ moduleId: string }>
}



export async function GET(_req: Request, { params }: RouteParams) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { moduleId } = await params
  if (!moduleId) return NextResponse.json({ error: 'Missing moduleId' }, { status: 400 })

  const [moduleRow, totalLessons, watchedRows] = await Promise.all([
    prisma.module.findUnique({
      where: { id: moduleId },
      select: { id: true },
    }),
    prisma.video.count({
      where: { chapter: { moduleId } },
    }),
    prisma.videoProgress.findMany({
      where: {
        userId,
        watched: true,
        video: { chapter: { moduleId } },
      },
      select: { videoId: true },
    }),
  ])

  if (!moduleRow) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (totalLessons === 0) {
    return NextResponse.json({
      moduleId,
      totalLessons,
      completedLessons: 0,
      percent: 0,
      watchedVideoIds: [],
    })
  }

  const watchedVideoIds = watchedRows.map((r) => r.videoId)
  const completedLessons = watchedVideoIds.length

  return NextResponse.json({
    moduleId,
    totalLessons,
    completedLessons,
    percent: learningPercent(completedLessons, totalLessons),
    watchedVideoIds,
  })
}
