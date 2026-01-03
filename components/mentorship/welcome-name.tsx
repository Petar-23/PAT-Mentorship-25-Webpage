'use client'

import { useUser } from '@clerk/nextjs'
import { useMemo } from 'react'

function getFirstNameLike(value: string | null | undefined) {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed) return null
  return trimmed.split(/\s+/)[0] ?? null
}

export function MentorshipWelcomeName() {
  const { user, isLoaded } = useUser()

  const firstName = useMemo(() => {
    if (!isLoaded) return null
    return (
      getFirstNameLike(user?.firstName) ??
      getFirstNameLike(user?.fullName) ??
      getFirstNameLike(user?.username) ??
      null
    )
  }, [isLoaded, user?.firstName, user?.fullName, user?.username])

  if (!firstName) return null

  return <span>, {firstName}!</span>
}




