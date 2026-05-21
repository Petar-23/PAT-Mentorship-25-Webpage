'use client'

import { SignInButton, useUser } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { trackConversion } from '@/components/analytics/tracking'

type HormoziLandingCtaButtonProps = {
  buttonText: string
  className: string
}

export function HormoziLandingCtaButton({ buttonText, className }: HormoziLandingCtaButtonProps) {
  const { isSignedIn } = useUser()
  const router = useRouter()

  const handleJoinClick = () => {
    trackConversion.ctaClick()
    router.push('/dashboard')
  }

  const handleSignInClick = () => {
    trackConversion.ctaClick()
    trackConversion.signInStart()
  }

  if (isSignedIn) {
    return (
      <Button size="lg" className={className} onClick={handleJoinClick}>
        {buttonText}
      </Button>
    )
  }

  return (
    <SignInButton mode="modal" forceRedirectUrl="/dashboard">
      <Button size="lg" className={className} onClick={handleSignInClick}>
        {buttonText}
      </Button>
    </SignInButton>
  )
}
