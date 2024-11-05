// src/components/layout/auth-buttons.tsx
'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { UserButton, SignInButton, useUser } from '@clerk/nextjs'
import { Button } from '@/components/ui/button'
//import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { AuthButtonsSkeleton } from '@/components/layout/auth-skeleton'

export default function AuthButtons() {
  const { isSignedIn, isLoaded } = useUser()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Show nothing during server render
  if (!mounted) {
    return null
  }

  // Show skeleton while loading auth state
  if (!isLoaded) {
    return <AuthButtonsSkeleton />
  }

  if (!isSignedIn) {
    return (
      <div className="flex items-center gap-4">
        <Link href="/#pricing" legacyBehavior passHref>
          <Button variant="ghost" >
            Pricing
          </Button>
        </Link>
        <Link href="/#features" legacyBehavior passHref>
          <Button variant="ghost" >
            Features
          </Button>
        </Link>
        <SignInButton mode="modal">
          <Button>
            Sign In
          </Button>
        </SignInButton>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-4">
      <Link href="/dashboard" legacyBehavior passHref>
        <Button variant="ghost" >
          Dashboard
        </Button>
      </Link>
      <UserButton afterSignOutUrl="/" />
    </div>
  )
}
