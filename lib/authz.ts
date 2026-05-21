import 'server-only'

import { auth, clerkClient } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { cache } from 'react'

const getIsAdminForUserId = cache(async (userId: string) => {
  const client = await clerkClient()
  const memberships = await client.users.getOrganizationMembershipList({
    userId,
    limit: 100,
  })

  return memberships.data.some((m) => m.role === 'org:admin')
})

function hasAdminSessionClaim(sessionClaims: unknown) {
  if (!sessionClaims || typeof sessionClaims !== 'object') return false

  const claims = sessionClaims as Record<string, unknown>
  return claims.org_role === 'org:admin' || claims.orgRole === 'org:admin'
}

export async function getIsAdmin(userId?: string, sessionClaims?: unknown) {
  if (userId) {
    if (hasAdminSessionClaim(sessionClaims)) return true
    return getIsAdminForUserId(userId)
  }

  const authState = await auth()
  const resolvedUserId = authState.userId
  if (!resolvedUserId) return false

  if (hasAdminSessionClaim(authState.sessionClaims)) return true

  return getIsAdminForUserId(resolvedUserId)
}

export async function requireAdminApiAccess() {
  const { userId, sessionClaims } = await auth()
  if (!userId) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    }
  }

  if (hasAdminSessionClaim(sessionClaims)) {
    return { ok: true as const, userId }
  }

  const isAdmin = await getIsAdminForUserId(userId)
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
