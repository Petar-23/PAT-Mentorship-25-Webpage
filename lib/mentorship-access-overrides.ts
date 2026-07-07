import 'server-only'

import { currentUser } from '@clerk/nextjs/server'
import { getEmailFromSessionClaims } from '@/lib/clerk-claims'

const MENTORSHIP_ACCESS_EMAIL_OVERRIDES = new Set(['petar_maric@icloud.com'])

export function isMentorshipAccessOverrideEmail(email: string | null | undefined) {
  return MENTORSHIP_ACCESS_EMAIL_OVERRIDES.has(String(email ?? '').trim().toLowerCase())
}

export async function hasMentorshipAccessOverride(sessionClaims?: unknown) {
  let email = getEmailFromSessionClaims(sessionClaims)
  if (!email) {
    const user = await currentUser()
    email = user?.primaryEmailAddress?.emailAddress ?? null
  }

  return isMentorshipAccessOverrideEmail(email)
}
