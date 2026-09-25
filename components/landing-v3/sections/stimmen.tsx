import { QUOTES, WHOP_URL, formatRating } from '@/components/landing-v3/content'
import type { LandingReviews } from '@/components/landing-v3/types'

const STAR = 'M10 .5L12.29 6.84L19.04 7.06L13.71 11.21L15.58 17.69L10 13.9L4.42 17.69L6.29 11.21L.96 7.06L7.71 6.84Z'

export function Stimmen({ reviews }: { reviews: LandingReviews }) {
  const rating = formatRating(reviews.average)
  return (
    <section className="sec band" id="stimmen" aria-labelledby="stimmen-title">
      <div className="wrap">
        <h2 id="stimmen-title">
          <span className="dim">Über 130 Mentees seit 2024.</span>
          <span>Das sagen sie.</span>
        </h2>
        <div className="sa-sheet">
          <div className="sa-score">
            <p className="sa-num">
              <span aria-hidden="true">{rating}</span>
              <span className="sa-sr">Bewertung {rating} von 5 Sternen</span>
            </p>
            <svg className="sa-stars" viewBox="0 0 108 20" aria-hidden="true">
              {[0, 22, 44, 66, 88].map((x) => (
                <path key={x} d={STAR} transform={x ? `translate(${x} 0)` : undefined} />
              ))}
            </svg>
            <p className="sa-count">
              <a className="lnk" href={WHOP_URL} target="_blank" rel="noopener">
                {reviews.countLabel} Bewertungen auf Whop<span className="sa-sr"> (öffnet in neuem Tab)</span>
              </a>
              <span>Öffentlich und für jeden nachlesbar.</span>
            </p>
          </div>
          <figure className="sa-main">
            <blockquote>
              „Er übersetzt nicht nur ICTs Lehren aus dem Englischen ins Deutsche, sondern er erklärt sie uns so{' '}lange, bis jeder es
              verstanden hat.“
            </blockquote>
            <figcaption className="sa-who">
              <b>Tino S.</b>Future Trader
            </figcaption>
          </figure>
          {QUOTES.map((quote) => (
            <figure className={quote.hideOnTablet ? 'sa-q sa-x' : 'sa-q'} key={quote.name}>
              <blockquote>„{quote.text}“</blockquote>
              <figcaption className="sa-who">
                <b>{quote.name}</b>
                {quote.role}
              </figcaption>
            </figure>
          ))}
        </div>
        <p className="sa-fine">Erfahrungen einzelner Mentees. Ergebnisse sind individuell und nicht garantiert.</p>
      </div>
    </section>
  )
}
