import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import { BunnyApiError, getBunnyVideoDetails } from '@/lib/bunny'
import { getMentorshipAccessState } from '@/lib/mentorship-access'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ guid: string }> }
) {
  const { userId, sessionClaims } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const access = await getMentorshipAccessState(userId, sessionClaims)
  if (!access.allowed) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { guid } = await params
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(guid)) {
    return NextResponse.json({ error: 'Missing guid' }, { status: 400 })
  }

  // Performance: DB-Cache zuerst (spart Bunny-API Calls)
  const cached = await prisma.video.findFirst({
    where: { bunnyGuid: guid },
    select: { duration: true },
  })

  if (cached?.duration != null && cached.duration > 0) {
    return NextResponse.json({ durationSeconds: cached.duration })
  }

  let json: Record<string, unknown>
  try {
    json = await getBunnyVideoDetails(guid)
  } catch (error) {
    if (error instanceof BunnyApiError) {
      return NextResponse.json({ error: error.body }, { status: error.status })
    }

    if (error instanceof Error && error.message.startsWith('Missing BUNNY_')) {
      return NextResponse.json({ error: 'Missing Bunny env' }, { status: 500 })
    }

    throw error
  }

  const rawLength =
    typeof json.length === 'number'
      ? json.length
      : typeof json.videoLength === 'number'
        ? json.videoLength
        : typeof json.duration === 'number'
          ? json.duration
          : null

  const durationSeconds =
    typeof rawLength === 'number' && Number.isFinite(rawLength) && rawLength > 0
      ? Math.round(rawLength)
      : null

  // Cache in DB (damit wir später z. B. Modul-Gesamtdauer schnell berechnen können)
  if (durationSeconds !== null) {
    await prisma.video.updateMany({
      where: { bunnyGuid: guid },
      data: { duration: durationSeconds },
    })
  }

  return NextResponse.json({ durationSeconds })
}
