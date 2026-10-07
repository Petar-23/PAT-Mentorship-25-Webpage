import { ETORO_FAQ, ETORO_OFFER, FAQ } from '@/components/landing-v3/content'

const ITEMS = ETORO_OFFER.enabled ? [...FAQ, ETORO_FAQ] : FAQ

export function Fragen() {
  return (
    <section className="sec" id="fragen" aria-labelledby="fragen-title">
      <div className="wrap faq-grid">
        <div>
          <h2 id="fragen-title">
            <span className="dim">Noch Fragen?</span>
            <span>Die häufigsten.</span>
          </h2>
          <p className="lead">Was hier nicht steht, fragst du am besten direkt in der Community oder im Q&amp;A am Monatsende.</p>
        </div>
        <div>
          {ITEMS.map((item, index) => (
            <details key={item.q} open={index === 0}>
              <summary>{item.q}</summary>
              <p className="faq-a">{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}
