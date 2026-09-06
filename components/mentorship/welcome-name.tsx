'use client'

import { useUser } from '@clerk/nextjs'

function getFirstNameLike(value: string | null | undefined) {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed) return null
  return trimmed.split(/\s+/)[0] ?? null
}

export function MentorshipWelcomeName() {
  const { user, isLoaded } = useUser()

  const firstName = isLoaded
    ? getFirstNameLike(user?.firstName) ?? getFirstNameLike(user?.fullName) ?? getFirstNameLike(user?.username)
    : null

  if (!firstName) return <span>.</span>

  return <span>, {firstName}.</span>
}
