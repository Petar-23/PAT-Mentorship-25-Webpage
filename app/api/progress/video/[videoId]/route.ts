import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'

type RouteParams = {
  params: Promise<{ videoId: string }>
}

export async function GET(_req: Request, { params }: RouteParams) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { videoId } = await params
  if (!videoId) return NextResponse.json({ error: 'Missing videoId' }, { status: 400 })

  const row = await prisma.videoProgress.findUnique({
    where: { userId_videoId: { userId, videoId } },
    select: { watched: true, watchedAt: true, manual: true },
  })

  return NextResponse.json({
    videoId,
    watched: row?.watched ?? false,
    watchedAt: row?.watchedAt ?? null,
    manual: row?.manual ?? false,
  })
}

export async function POST(req: Request, { params }: RouteParams) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { videoId } = await params
  if (!videoId) return NextResponse.json({ error: 'Missing videoId' }, { status: 400 })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    body = {}
  }

  const record = body && typeof body === 'object' ? (body as Record<string, unknown>) : {}
  const watched = record.watched
  const manual = record.manual

  if (typeof watched !== 'boolean') {
    return NextResponse.json({ error: 'watched must be boolean' }, { status: 400 })
  }

  const now = new Date()

  const row = await prisma.videoProgress.upsert({
    where: { userId_videoId: { userId, videoId } },
    create: {
      userId,
      videoId,
      watched,
      watchedAt: watched ? now : null,
      manual: typeof manual === 'boolean' ? manual : false,
    },
    update: {
      watched,
      watchedAt: watched ? now : null,
      manual: typeof manual === 'boolean' ? manual : undefined,
    },
    select: { watched: true, watchedAt: true, manual: true },
  })

  return NextResponse.json({
    videoId,
    watched: row.watched,
    watchedAt: row.watchedAt ?? null,
    manual: row.manual,
  })
}


