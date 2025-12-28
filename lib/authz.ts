import 'server-only'

import { auth, clerkClient } from '@clerk/nextjs/server'
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


