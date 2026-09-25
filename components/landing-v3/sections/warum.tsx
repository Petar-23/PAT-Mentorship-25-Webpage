import { Drawing } from '@/components/landing-v3/drawing'
import { WARUM_SVG } from '@/components/landing-v3/drawings.generated'

export function Warum() {
  return (
    <section className="sec band why wc" id="warum" aria-labelledby="warum-title">
      <div className="wc-track">
        <div className="wrap split wc-stage">
          <div className="wc-text">
            <h2 id="warum-title">
              <span className="dim">ICT ist genial.</span>
              <span>Aber verstreut.</span>
            </h2>
            <p className="lead wc-p1">Über tausend Stunden Material, auf Englisch, verteilt über viele Jahre und ohne feste Reihenfolge.</p>
            <p className="lead wc-p2">
              Ich habe es durchgearbeitet und in einen Lehrplan gebracht, der aufeinander aufbaut. So lernst du jeden Baustein genau dann,
              wenn du ihn brauchst.
            </p>
          </div>
          <Drawing svg={WARUM_SVG} />
        </div>
      </div>
    </section>
  )
}
