import { prisma } from '@/lib/prisma'
import { auth, clerkClient } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import {
  ONBOARDING_VIDEO_SETTING_KEY,
  buildOnboardingVideoSetting,
  getOnboardingEmbedUrl,
  parseOnboardingVideoSetting,
  sanitizeOnboardingVideoId,
} from '@/lib/onboarding-video'
import { getOnboardingVideoExpiryDate } from '@/lib/onboarding-video-expiry'

async function requireAdmin() {
  const { userId } = await auth()
  if (!userId) {
    return { ok: false as const, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  const client = await clerkClient()
  const memberships = await client.users.getOrganizationMembershipList({
    userId,
    limit: 100,
  })

  const isAdmin = memberships.data.some((membership) => membership.role === 'org:admin')
  if (!isAdmin) {
    return { ok: false as const, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }

  return { ok: true as const, userId }
}

export async function GET() {
  const guard = await requireAdmin()
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
  const guard = await requireAdmin()
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
