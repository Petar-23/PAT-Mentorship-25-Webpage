import { DEFAULT_ONBOARDING_VIDEO_EXPIRY } from '@/lib/onboarding-video'

export function getOnboardingVideoExpiryDate(): Date {
  const fromEnv = process.env.ONBOARDING_VIDEO_EXPIRY?.trim()
  if (fromEnv) {
    const parsed = new Date(fromEnv)
    if (!Number.isNaN(parsed.getTime())) {
      return parsed
    }
  }

  return new Date(DEFAULT_ONBOARDING_VIDEO_EXPIRY)
}

export function isOnboardingVideoExpired(now: Date = new Date()): boolean {
  return now.getTime() > getOnboardingVideoExpiryDate().getTime()
}
