import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createSignedBunnyEmbedUrl } from '@/lib/bunny-playback'
import { getMentorshipAccessState } from '@/lib/mentorship-access'
import {
  ONBOARDING_VIDEO_SETTING_KEY,
  parseOnboardingVideoSetting,
  sanitizeOnboardingVideoId,
} from '@/lib/onboarding-video'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

type RouteParams = {
  params: Promise<{ videoGuid: string }>
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { userId, sessionClaims } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const access = await getMentorshipAccessState(userId, sessionClaims)
  if (!access.allowed) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const requestedVideoGuid = sanitizeOnboardingVideoId((await params).videoGuid)
  if (!requestedVideoGuid) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const setting = await prisma.adminSetting.findUnique({
    where: { key: ONBOARDING_VIDEO_SETTING_KEY },
    select: { value: true },
  })
  const configuredVideo = parseOnboardingVideoSetting(setting?.value).videoId

  if (!configuredVideo || configuredVideo !== requestedVideoGuid) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  try {
    const signed = createSignedBunnyEmbedUrl({ videoGuid: configuredVideo, autoplay: false })
    return NextResponse.json(signed, {
      headers: {
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (error) {
    console.error('[bunny-playback] Failed to create onboarding playback URL:', error)
    return NextResponse.json(
      { error: 'Playback is not configured.' },
      { status: 503, headers: { 'Cache-Control': 'private, no-store' } }
    )
  }
}
