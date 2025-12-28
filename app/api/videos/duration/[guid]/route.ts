import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'

const BUNNY_LIBRARY_ID = process.env.BUNNY_LIBRARY_ID
const BUNNY_API_KEY = process.env.BUNNY_API_KEY

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ guid: string }> }
) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!BUNNY_LIBRARY_ID || !BUNNY_API_KEY) {
    return NextResponse.json({ error: 'Missing Bunny env' }, { status: 500 })
  }

  const { guid } = await params
  if (!guid) {
    return NextResponse.json({ error: 'Missing guid' }, { status: 400 })
  }

  const res = await fetch(
    `https://video.bunnycdn.com/library/${BUNNY_LIBRARY_ID}/videos/${guid}`,
    {
      headers: { AccessKey: BUNNY_API_KEY },
      cache: 'no-store',
    }
  )

  if (!res.ok) {
    return NextResponse.json({ error: await res.text() }, { status: res.status })
  }

  const json = (await res.json()) as Record<string, unknown>

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