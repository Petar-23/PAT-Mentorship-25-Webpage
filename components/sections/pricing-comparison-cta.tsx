'use client'

import { SignInButton, useUser } from '@clerk/nextjs'
import { ArrowRight } from '@phosphor-icons/react/ArrowRight'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

export function PricingComparisonCta() {
  const { isSignedIn } = useUser()
  const router = useRouter()

  if (isSignedIn) {
    return (
      <Button
        size="lg"
        onClick={() => router.push('/dashboard')}
        className="gap-2"
      >
        Jetzt Platz sichern
        <ArrowRight className="h-4 w-4" />
      </Button>
    )
  }

  return (
    <SignInButton mode="modal" forceRedirectUrl="/dashboard">
      <Button size="lg" className="gap-2">
        Jetzt Platz sichern
        <ArrowRight className="h-4 w-4" />
      </Button>
    </SignInButton>
  )
}
