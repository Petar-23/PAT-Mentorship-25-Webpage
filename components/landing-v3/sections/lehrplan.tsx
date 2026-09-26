import { LEHRPLAN_SVGS } from '@/components/landing-v3/drawings.generated'
import { PHASES } from '@/components/landing-v3/content'

export function Lehrplan() {
  return (
    <section className="sec" id="lehrplan" aria-labelledby="lehrplan-title">
      <div className="wrap">
        <div className="head">
          <h2 id="lehrplan-title">
            <span className="dim">Zwölf Monate.</span>
            <span>Ein klarer Weg.</span>
          </h2>
          <p className="lead">
            Der Lehrplan baut Monat für Monat aufeinander auf. Du kannst jederzeit einsteigen: Alle bisherigen Lektionen sind aufgezeichnet,
            so holst du in deinem Tempo auf.
          </p>
        </div>
        <div className="lz" id="lehrplan-zeit">
          <ol className="lz-phases">
            {PHASES.map((phase, i) => (
              <li className="lz-ph" data-i={i} key={phase.title}>
                <figure className="lz-fig" dangerouslySetInnerHTML={{ __html: LEHRPLAN_SVGS[i] }} />
                <span className="label lz-when lz-t">{phase.when}</span>
                <div className="lz-rule" aria-hidden="true">
                  <i className="lz-base" />
                  <i className="lz-prog" />
                  <i className="lz-mo lz-m1" />
                  <i className="lz-mo lz-m2" />
                  <i className="lz-sl" />
                  {i === PHASES.length - 1 ? <i className="lz-sl lz-end" /> : null}
                  <i className="lz-dot" />
                </div>
                <div className="lz-body">
                  <h3 className="lz-t">{phase.title}</h3>
                  <ul>
                    {phase.items.map((item) => (
                      <li className="lz-t" key={item}>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </li>
            ))}
          </ol>
        </div>
        <Woche />
      </div>
    </section>
  )
}

function Woche() {
  return (
    <div className="la-week" id="woche">
      <div className="la-intro">
        <h3 className="la-week-h" id="woche-title">
          <span className="dim">Deine Woche.</span>
          <span>Zwei Termine live.</span>
        </h3>
        <p>
          Der Rest läuft in deinem Tempo. Alles bleibt als Aufzeichnung verfügbar, auch die <span className="la-nw">Live-Termine</span>.
        </p>
      </div>
      <div className="la-sched">
        <p className="la-key label">
          <span className="la-legend" aria-hidden="true">
            <span>
              <i className="la-dot" />
              Live
            </span>
            <span>
              <i className="la-dot la-o" />
              Aufzeichnung
            </span>
          </span>
          <span>Deutsche Zeit</span>
        </p>
        <dl className="la-list" aria-labelledby="woche-title">
          <div className="la-day">
            <dt>Dienstag</dt>
            <dd>
              <i className="la-dot la-o" role="img" aria-label="Aufzeichnung" />
              <time dateTime="08:00">08:00</time>
              <span className="la-t">Daily Review</span>
            </dd>
            <dd className="la-live">
              <i className="la-dot" role="img" aria-label="Live" />
              <time dateTime="19:00">19:00</time>
              <span className="la-t">Live-Marktanalyse</span>
            </dd>
          </div>
          <div className="la-day">
            <dt>Donnerstag</dt>
            <dd>
              <i className="la-dot la-o" role="img" aria-label="Aufzeichnung" />
              <time dateTime="08:00">08:00</time>
              <span className="la-t">Daily Review</span>
            </dd>
            <dd className="la-live">
              <i className="la-dot" role="img" aria-label="Live" />
              <time dateTime="19:00">19:00</time>
              <span className="la-t">Live Call: Training und Markt</span>
            </dd>
          </div>
          <div className="la-day">
            <dt>Sonntag</dt>
            <dd>
              <i className="la-dot la-o" role="img" aria-label="Aufzeichnung" />
              <span className="la-when">Abends</span>
              <span className="la-t">
                Weekly Recap <small>Wochenrückblick</small>
              </span>
            </dd>
          </div>
        </dl>
        <p className="la-extra">
          <i className="la-dot" role="img" aria-label="Live" />
          <span>
            Am Monatsende zusätzlich ein <b>Q&amp;A-Livestream</b>.
          </span>
        </p>
      </div>
    </div>
  )
}
