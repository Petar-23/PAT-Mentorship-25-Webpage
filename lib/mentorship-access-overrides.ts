import 'server-only'

import { currentUser } from '@clerk/nextjs/server'
import {
  getVerifiedPrimaryEmail,
  normalizeEmailAddress,
  parseNormalizedEmailCsv,
  type VerifiedEmailAddress,
} from '@/lib/clerk-email'

function getConfiguredOverrideEmails() {
  return parseNormalizedEmailCsv(process.env.MENTORSHIP_ACCESS_OVERRIDE_EMAILS)
}

export function isMentorshipAccessOverrideEmail(
  verifiedEmail: VerifiedEmailAddress | null | undefined
) {
  if (!verifiedEmail) return false
  return getConfiguredOverrideEmails().has(normalizeEmailAddress(verifiedEmail))
}

export async function hasMentorshipAccessOverride(_sessionClaims?: unknown) {
  const user = await currentUser()
  return isMentorshipAccessOverrideEmail(getVerifiedPrimaryEmail(user))
}
