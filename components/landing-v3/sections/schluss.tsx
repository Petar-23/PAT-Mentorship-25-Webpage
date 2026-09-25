import { Drawing } from '@/components/landing-v3/drawing'
import { PLAN_CANDLE_SVG } from '@/components/landing-v3/drawings.generated'
import { ASSURE, CTA_LABEL, checkoutHref, ctaSource } from '@/components/landing-v3/content'

export function Schluss() {
  return (
    <section className="sec final" aria-labelledby="final-title">
      <div className="wrap final-grid">
        <div>
          <h2 id="final-title">
            <span className="dim">Die erste Lektion</span>
            <span>wartet schon.</span>
          </h2>
          <p className="lead">Du startest bei den Grundlagen und baust Schritt für Schritt auf. Wenn es nicht passt, kündigst du zum Monatsende.</p>
          <div className="cta">
            <a className="btn btn-accent" href={checkoutHref('final')} data-cta={ctaSource('final')}>
              {CTA_LABEL} <span className="arr" aria-hidden="true">→</span>
            </a>
            <p className="assure">
              {ASSURE.title}
              <span>{ASSURE.detail}</span>
            </p>
          </div>
        </div>
        <Drawing svg={PLAN_CANDLE_SVG} />
      </div>
    </section>
  )
}
