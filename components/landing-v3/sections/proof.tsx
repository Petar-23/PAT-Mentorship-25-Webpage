import { formatRating } from '@/components/landing-v3/content'
import type { LandingReviews } from '@/components/landing-v3/types'

export function Proof({ reviews }: { reviews: LandingReviews }) {
  return (
    <section className="proof" aria-label="Auf einen Blick">
      <div className="wrap proof-grid">
        <div>
          <b>
            {formatRating(reviews.average)}{' '}
            <span className="stars" aria-hidden="true">
              ★★★★★
            </span>
          </b>
          <span className="l">{reviews.countLabel} Bewertungen auf Whop</span>
        </div>
        <div>
          <b>130+</b>
          <span className="l">Mentees seit 2024</span>
        </div>
        <div>
          <b>1.000+ Stunden</b>
          <span className="l">ICT-Material für dich sortiert</span>
        </div>
        <div>
          <b>Keine Signale</b>
          <span className="l">Du lernst, selbst zu analysieren</span>
        </div>
      </div>
    </section>
  )
}
