'use client'

import { useEffect, useRef, useState } from 'react'
import { SignInButton, useUser } from '@clerk/nextjs'
import { ArrowRight } from '@phosphor-icons/react/ArrowRight'
import { SpinnerGap } from '@phosphor-icons/react/SpinnerGap'
import { useRouter } from 'next/navigation'
import { trackConversion } from '@/components/analytics/tracking'
import { Button, type ButtonProps } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type MentorshipEntryCtaProps = Pick<ButtonProps, 'size' | 'variant'> & {
  className?: string
  label?: string
  source: string
}

export function MentorshipEntryCta({
  className,
  label = 'Einstieg starten',
  size = 'lg',
  source,
  variant = 'default',
}: MentorshipEntryCtaProps) {
  const { isLoaded, isSignedIn } = useUser()
  const router = useRouter()
  const [isNavigating, setIsNavigating] = useState(false)
  const navigationTimeoutRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (navigationTimeoutRef.current !== null) {
        window.clearTimeout(navigationTimeoutRef.current)
      }
    }
  }, [])

  const handleSignedInClick = () => {
    if (isNavigating) return

    trackConversion.ctaClick(source)
    setIsNavigating(true)
    router.push('/dashboard')

    navigationTimeoutRef.current = window.setTimeout(() => {
      setIsNavigating(false)
      navigationTimeoutRef.current = null
    }, 1200)
  }

  const handleSignInClick = () => {
    trackConversion.ctaClick(source)
    trackConversion.signInStart(source)
  }

  const buttonContent = (
    <>
      <span>{label}</span>
      {isNavigating ? (
        <SpinnerGap aria-hidden="true" className="h-4 w-4 animate-spin motion-reduce:animate-none" />
      ) : (
        <ArrowRight aria-hidden="true" className="h-4 w-4" />
      )}
    </>
  )

  const buttonClassName = cn('touch-manipulation', className)

  if (!isLoaded) {
    return (
      <Button disabled size={size} variant={variant} className={buttonClassName}>
        <span>{label}</span>
        <ArrowRight aria-hidden="true" className="h-4 w-4" />
      </Button>
    )
  }

  if (isSignedIn) {
    return (
      <Button
        type="button"
        size={size}
        variant={variant}
        className={buttonClassName}
        disabled={isNavigating}
        aria-busy={isNavigating}
        aria-label={isNavigating ? 'Einstieg wird geöffnet' : undefined}
        onClick={handleSignedInClick}
      >
        {buttonContent}
      </Button>
    )
  }

  return (
    <SignInButton mode="modal" forceRedirectUrl="/dashboard">
      <Button
        type="button"
        size={size}
        variant={variant}
        className={buttonClassName}
        onClick={handleSignInClick}
      >
        {buttonContent}
      </Button>
    </SignInButton>
  )
}
