import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    body = {}
  }

  const record = body && typeof body === 'object' ? (body as Record<string, unknown>) : {}
  const videoId = record.videoId

  if (typeof videoId !== 'string' || videoId.length === 0) {
    return NextResponse.json({ error: 'videoId must be a string' }, { status: 400 })
  }

  const now = new Date()

  try {
    await prisma.userPlaybackState.upsert({
      where: { userId },
      create: { userId, lastVideoId: videoId, lastViewedAt: now },
      update: { lastVideoId: videoId, lastViewedAt: now },
      select: { id: true },
    })
  } catch (err) {
    console.error('Failed to persist last-viewed video:', err)
    // Absichtlich kein harter Fehler für den Client: UI soll nicht blockieren.
    return NextResponse.json({ ok: false }, { status: 200 })
  }

  return NextResponse.json({ ok: true })
}




