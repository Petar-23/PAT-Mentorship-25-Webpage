import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { requireAdminApiAccess } from '@/lib/authz'
import {
  ONBOARDING_VIDEO_SETTING_KEY,
  buildOnboardingVideoSetting,
  getOnboardingEmbedUrl,
  parseOnboardingVideoSetting,
  sanitizeOnboardingVideoId,
} from '@/lib/onboarding-video'
import { getOnboardingVideoExpiryDate } from '@/lib/onboarding-video-expiry'

export async function GET() {
  const guard = await requireAdminApiAccess()
  if (!guard.ok) return guard.response

  const setting = await prisma.adminSetting.findUnique({
    where: { key: ONBOARDING_VIDEO_SETTING_KEY },
    select: { value: true },
  })

  const parsed = parseOnboardingVideoSetting(setting?.value)
  return NextResponse.json({
    videoId: parsed.videoId,
    updatedAt: parsed.updatedAt,
    expiresAt: getOnboardingVideoExpiryDate().toISOString(),
    embedUrl: parsed.videoId ? getOnboardingEmbedUrl(parsed.videoId) : null,
  })
}

export async function POST(request: Request) {
  const guard = await requireAdminApiAccess()
  if (!guard.ok) return guard.response

  const body = (await request.json().catch(() => null)) as { videoId?: unknown } | null
  const incomingVideoId = body?.videoId

  const sanitizedVideoId =
    typeof incomingVideoId === 'string' && incomingVideoId.trim() === ''
      ? null
      : sanitizeOnboardingVideoId(incomingVideoId)

  if (incomingVideoId != null && typeof incomingVideoId !== 'string') {
    return NextResponse.json({ error: 'Invalid videoId type' }, { status: 400 })
  }

  if (typeof incomingVideoId === 'string' && incomingVideoId.trim() !== '' && !sanitizedVideoId) {
    return NextResponse.json({ error: 'Invalid videoId format' }, { status: 400 })
  }

  const value = buildOnboardingVideoSetting(sanitizedVideoId)

  await prisma.adminSetting.upsert({
    where: { key: ONBOARDING_VIDEO_SETTING_KEY },
    update: { value },
    create: { key: ONBOARDING_VIDEO_SETTING_KEY, value },
  })

  return NextResponse.json({
    success: true,
    videoId: value.videoId,
    updatedAt: value.updatedAt,
    expiresAt: getOnboardingVideoExpiryDate().toISOString(),
    embedUrl: value.videoId ? getOnboardingEmbedUrl(value.videoId) : null,
  })
}
