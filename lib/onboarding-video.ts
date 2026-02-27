export const ONBOARDING_VIDEO_SETTING_KEY = 'onboardingVideoM26'
export const ONBOARDING_VIDEO_BUNNY_LIBRARY_ID =
  process.env.NEXT_PUBLIC_BUNNY_LIBRARY_ID || process.env.BUNNY_LIBRARY_ID || ''
export const ONBOARDING_VIDEO_DISMISS_STORAGE_PREFIX = 'pat:onboarding-video:m26'
export const DEFAULT_ONBOARDING_VIDEO_EXPIRY = '2026-03-15T23:59:59+01:00'

export type OnboardingVideoSettingValue = {
  videoId: string | null
  updatedAt: string
}

export function sanitizeOnboardingVideoId(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null

  // Bunny GUIDs sind i.d.R. UUID-ähnlich; wir erlauben nur sichere URL-Zeichen.
  if (!/^[a-zA-Z0-9-]{6,100}$/.test(trimmed)) {
    return null
  }

  return trimmed
}

export function parseOnboardingVideoSetting(value: unknown): OnboardingVideoSettingValue {
  if (!value || typeof value !== 'object') {
    return { videoId: null, updatedAt: new Date(0).toISOString() }
  }

  const candidate = value as { videoId?: unknown; updatedAt?: unknown }
  const videoId = sanitizeOnboardingVideoId(candidate.videoId)
  const updatedAt =
    typeof candidate.updatedAt === 'string' && !Number.isNaN(Date.parse(candidate.updatedAt))
      ? candidate.updatedAt
      : new Date(0).toISOString()

  return { videoId, updatedAt }
}

export function buildOnboardingVideoSetting(videoId: string | null): OnboardingVideoSettingValue {
  return {
    videoId,
    updatedAt: new Date().toISOString(),
  }
}

export function getOnboardingDismissStorageKey(videoId: string): string {
  return `${ONBOARDING_VIDEO_DISMISS_STORAGE_PREFIX}:${videoId}`
}

export function getOnboardingEmbedUrl(videoId: string): string {
  return `https://iframe.mediadelivery.net/embed/${ONBOARDING_VIDEO_BUNNY_LIBRARY_ID}/${videoId}`
}
