import 'server-only'

import { auth, clerkClient } from '@clerk/nextjs/server'
import { cache } from 'react'
import { getMentorshipAccessState } from '@/lib/mentorship-access'
import { isPlatformPreviewAdmin } from '@/lib/customer-preview-policy'

// Do not use the legacy any-organization admin guard for cross-customer data.
// React cache only deduplicates within a server render; authorization is checked on each request.
export const getCustomerPreviewAdmin = cache(async () => {
  const { userId } = await auth()
  if (!userId) return { ok: false as const, status: 401 }
  const organizationId = process.env.CLERK_ADMIN_ORGANIZATION_ID?.trim()
  if (!organizationId) return { ok: false as const, status: 503 }
  const client = await clerkClient()
  const memberships = await client.users.getOrganizationMembershipList({ userId, limit: 100 })
  if (!isPlatformPreviewAdmin(memberships.data, organizationId)) {
    return { ok: false as const, status: 403 }
  }
  return { ok: true as const, actorId: userId }
})

export const getCustomerPreview = cache(async (targetUserId: string) => {
  const admin = await getCustomerPreviewAdmin()
  if (!admin.ok) return admin
  if (!/^user_[a-zA-Z0-9]+$/.test(targetUserId)) return { ok: false as const, status: 404 }
  const client = await clerkClient()
  let target
  try {
    target = await client.users.getUser(targetUserId)
  } catch (error) {
    if ((error as { status?: number }).status === 404) return { ok: false as const, status: 404 }
    throw error
  }
  const primary = target.emailAddresses.find(email => email.id === target.primaryEmailAddressId)
  const verifiedEmail = primary?.verification?.status === 'verified' ? primary.emailAddress : null
  const access = await getMentorshipAccessState(target.id, undefined, {
    customerPreview: { verifiedEmail },
  })
  const accountBlocked = target.banned || target.locked
  const allowed = !accountBlocked && access.allowed
  console.info('customer_preview_open', {
    actorId: admin.actorId, targetUserId: target.id, allowed, at: new Date().toISOString(),
  })
  return {
    ok: true as const,
    customer: {
      id: target.id,
      name: [target.firstName, target.lastName].filter(Boolean).join(' ') || 'Kunde',
      firstName: target.firstName,
      email: primary?.emailAddress ?? null,
    },
    access: { ...access, allowed },
    reason: accountBlocked ? 'Dieses Kundenkonto ist gesperrt.'
      : !access.hasSubscription ? 'Für dieses Kundenkonto wird kein aktiver Mentorship-Zugang erkannt.'
      : !access.mentorshipAccessible ? 'Die Mentorship ist noch nicht freigeschaltet.' : null,
  }
})
