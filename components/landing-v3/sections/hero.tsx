import { Trailer } from '@/components/landing-v3/client/trailer'
import { ASSURE, CTA_LABEL, checkoutHref, ctaSource } from '@/components/landing-v3/content'

export function Hero() {
  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className="wrap hero-grid">
        <div>
          <p className="kicker rise">PAT Mentorship 2026</p>
          <h1 id="hero-title">
            <span className="dim rise">ICT verstehen.</span>
            <span className="dim rise">Auf Deutsch.</span>
            <span className="rise">Schritt für Schritt.</span>
          </h1>
          <p className="sub rise">
            Ich erkläre dir die Konzepte von ICT in einem klaren Lehrplan, verständlich und in deinem Tempo. In Live-Sessions
            schauen wir sie gemeinsam am aktuellen Markt an.
          </p>
          <div className="cta rise">
            <a className="btn btn-accent" href={checkoutHref('hero')} data-cta={ctaSource('hero')}>
              {CTA_LABEL} <span className="arr" aria-hidden="true">→</span>
            </a>
            <p className="assure">
              {ASSURE.title}
              <span>{ASSURE.detail}</span>
            </p>
          </div>
        </div>
        <Trailer />
      </div>
    </section>
  )
}
