import 'server-only'

import { auth, clerkClient } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { cache } from 'react'
import {
  PLATFORM_ADMIN_ROLE,
  getConfiguredAdminOrganizationId,
  hasPlatformAdminSessionClaim,
  isPlatformAdminContext,
} from '@/lib/authz-policy'

const getIsAdminForUserId = cache(async (userId: string, adminOrganizationId: string) => {
  const client = await clerkClient()
  const memberships = await client.users.getOrganizationMembershipList({
    userId,
    limit: 100,
  })

  return memberships.data.some(
    (membership) =>
      membership.role === PLATFORM_ADMIN_ROLE &&
      membership.organization.id === adminOrganizationId
  )
})

function getAdminOrganizationId() {
  return getConfiguredAdminOrganizationId(process.env.CLERK_ADMIN_ORGANIZATION_ID)
}

export async function getIsAdmin(userId?: string, sessionClaims?: unknown) {
  const adminOrganizationId = getAdminOrganizationId()
  if (!adminOrganizationId) return false

  if (userId) {
    if (hasPlatformAdminSessionClaim(sessionClaims, adminOrganizationId)) return true
    return getIsAdminForUserId(userId, adminOrganizationId)
  }

  const authState = await auth()
  const resolvedUserId = authState.userId
  if (!resolvedUserId) return false

  if (
    isPlatformAdminContext(
      { orgId: authState.orgId, orgRole: authState.orgRole },
      adminOrganizationId
    ) ||
    hasPlatformAdminSessionClaim(authState.sessionClaims, adminOrganizationId)
  ) {
    return true
  }

  return getIsAdminForUserId(resolvedUserId, adminOrganizationId)
}

export async function requireAdminApiAccess() {
  const authState = await auth()
  const { userId, sessionClaims } = authState
  if (!userId) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    }
  }

  const adminOrganizationId = getAdminOrganizationId()
  if (!adminOrganizationId) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    }
  }

  if (
    isPlatformAdminContext(
      { orgId: authState.orgId, orgRole: authState.orgRole },
      adminOrganizationId
    ) ||
    hasPlatformAdminSessionClaim(sessionClaims, adminOrganizationId)
  ) {
    return { ok: true as const, userId }
  }

  const isAdmin = await getIsAdminForUserId(userId, adminOrganizationId)
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
