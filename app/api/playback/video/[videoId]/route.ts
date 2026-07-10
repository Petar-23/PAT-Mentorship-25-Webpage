import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createSignedBunnyEmbedUrl } from '@/lib/bunny-playback'
import { getMentorshipAccessState } from '@/lib/mentorship-access'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

type RouteParams = {
  params: Promise<{ videoId: string }>
}

export async function GET(request: Request, { params }: RouteParams) {
  const { userId, sessionClaims } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const access = await getMentorshipAccessState(userId, sessionClaims)
  if (!access.allowed) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { videoId } = await params
  const video = await prisma.video.findUnique({
    where: { id: videoId },
    select: { bunnyGuid: true },
  })

  if (!video?.bunnyGuid) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  try {
    const autoplay = new URL(request.url).searchParams.get('autoplay') === 'true'
    const signed = createSignedBunnyEmbedUrl({ videoGuid: video.bunnyGuid, autoplay })

    return NextResponse.json(signed, {
      headers: {
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (error) {
    console.error('[bunny-playback] Failed to create signed playback URL:', error)
    return NextResponse.json(
      { error: 'Playback is not configured.' },
      { status: 503, headers: { 'Cache-Control': 'private, no-store' } }
    )
  }
}
