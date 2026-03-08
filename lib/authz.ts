import 'server-only'

import { auth, clerkClient } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { cache } from 'react'

export const getIsAdmin = cache(async () => {
  const { userId } = await auth()
  if (!userId) return false

  const client = await clerkClient()
  const memberships = await client.users.getOrganizationMembershipList({
    userId,
    limit: 100,
  })

  return memberships.data.some((m) => m.role === 'org:admin')
})

export async function requireAdminApiAccess() {
  const { userId } = await auth()
  if (!userId) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    }
  }

  const isAdmin = await getIsAdmin()
  if (!isAdmin) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    }
  }

  return { ok: true as const, userId }
}

export function isMentorshipAccessible(): boolean {
  const startDateStr = process.env.MENTORSHIP_START_DATE

  if (!startDateStr) {
    return true // Kein Datum gesetzt = freier Zugang
  }

  try {
    const startDate = new Date(startDateStr)
    const now = new Date()
    return now >= startDate
  } catch (error) {
    console.warn('Invalid MENTORSHIP_START_DATE format:', startDateStr, error)
    return true // Ungültiges Datum = freier Zugang (sicherer Fallback)
  }
}

