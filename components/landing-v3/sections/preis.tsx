import { CTA_LABEL, OFFER_FEATURES, PRICE_LABEL, checkoutHref, ctaSource } from '@/components/landing-v3/content'
import { MENTORSHIP_CONFIG } from '@/lib/config'

export function Preis() {
  return (
    <section className="sec" id="preis" aria-labelledby="preis-title">
      <div className="wrap offer-grid">
        <div>
          <h2 id="preis-title">
            <span className="dim">Ein Preis.</span>
            <span>Monatlich kündbar.</span>
          </h2>
          <p className="lead">
            Du zahlst monatlich und entscheidest jeden Monat neu, ob die Mentorship zu dir passt. Keine Mindestlaufzeit, keine Einmalzahlung
            vorab.
          </p>
        </div>
        <div className="offer" id="offer">
          <p className="nm">{MENTORSHIP_CONFIG.programName}</p>
          <p className="amt">
            <b>{PRICE_LABEL}</b>
            <span>pro Monat</span>
          </p>
          <p className="terms">inkl. MwSt., monatlich kündbar</p>
          <ul>
            {OFFER_FEATURES.map((feature) => (
              <li key={feature}>{feature}</li>
            ))}
          </ul>
          <a className="btn btn-accent" href={checkoutHref('offer')} data-cta={ctaSource('offer')}>
            {CTA_LABEL} <span className="arr" aria-hidden="true">→</span>
          </a>
          <p className="fine">
            Kündigung mit einem Tag Frist zum Monatsende.
            <br />
            Keine Signale, keine Gewinnversprechen.
          </p>
        </div>
      </div>
    </section>
  )
}
