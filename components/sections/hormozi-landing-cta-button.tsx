import { MentorshipEntryCta } from '@/components/sections/mentorship-entry-cta'

type HormoziLandingCtaButtonProps = {
  buttonText: string
  className: string
}

export function HormoziLandingCtaButton({ buttonText, className }: HormoziLandingCtaButtonProps) {
  return (
    <MentorshipEntryCta
      source="lp_v1_cta"
      label={buttonText}
      className={className}
    />
  )
}
