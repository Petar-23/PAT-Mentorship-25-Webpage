import Image from 'next/image'
import { Star } from '@phosphor-icons/react/dist/ssr/Star'
import { HeroPill } from '@/components/ui/hero-pill'

const WHOP_REVIEWS_URL =
  'https://whop.com/price-action-trader-mentorship-24-d9/pat-mentorship-2025/'

export function LeadMagnetWhopPill() {
  return (
    <HeroPill
      href={WHOP_REVIEWS_URL}
      isExternal
      variant="amber"
      size="sm"
      announcement={
        <span className="flex items-center gap-1.5">
          <Image
            src="/images/whop-logo.png"
            alt="Whop"
            width={16}
            height={16}
            className="h-4 w-4"
          />
          <span className="flex items-center gap-0.5">
            {[1, 2, 3, 4, 5].map(star => (
              <Star
                key={star}
                className="h-3 w-3 fill-amber-500 text-amber-500"
                aria-hidden="true"
              />
            ))}
          </span>
        </span>
      }
      label="51 Bewertungen"
    />
  )
}
