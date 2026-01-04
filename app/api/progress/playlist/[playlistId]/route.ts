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

  const playlist = await prisma.playlist.findUnique({
    where: { id: playlistId },
    select: {
      id: true,
      modules: {
        select: {
          id: true,
          chapters: {
            select: {
              videos: { select: { id: true } },
            },
          },
        },
      },
    },
  })

  if (!playlist) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const moduleVideoIds = new Map<string, string[]>()
  const allVideoIds: string[] = []

  for (const m of playlist.modules) {
    const ids = m.chapters.flatMap((ch) => ch.videos.map((v) => v.id))
    moduleVideoIds.set(m.id, ids)
    allVideoIds.push(...ids)
  }

  const uniqueAllVideoIds = Array.from(new Set(allVideoIds))

  const watched = uniqueAllVideoIds.length
    ? await prisma.videoProgress.findMany({
        where: { userId, watched: true, videoId: { in: uniqueAllVideoIds } },
        select: { videoId: true },
      })
    : []

  const watchedSet = new Set(watched.map((r) => r.videoId))

  const modules: Record<
    string,
    { totalLessons: number; completedLessons: number; percent: number }
  > = {}

  for (const [moduleId, ids] of moduleVideoIds.entries()) {
    const totalLessons = ids.length
    const completedLessons = ids.reduce((sum, id) => sum + (watchedSet.has(id) ? 1 : 0), 0)
    modules[moduleId] = {
      totalLessons,
      completedLessons,
      percent: percent(completedLessons, totalLessons),
    }
  }

  return NextResponse.json({ playlistId, modules })
}


