import type { RegelDaten } from '@/lib/prop-firm/konten'
import { FIRMEN } from '@/lib/prop-firm/konten'
import { woerterbuch, type Absatz, type Sprache } from './texte'

/** Quellen je Firma, mit Quellen-ID als eindeutigem Schlüssel (verschiedene IDs können dieselbe URL haben). */
export function quellenJeFirma(daten: RegelDaten) {
  return FIRMEN.map((firma) => {
    const ids = new Set<string>()
    for (const k of [...daten.konten, ...daten.nicht_simulierbar]) if (k.firma === firma) k.quellen.forEach((q) => ids.add(q))
    const quellen = [...ids].sort().filter((id) => daten.quellen[id]).map((id) => ({ id, ...daten.quellen[id] }))
    return { firma, quellen }
  })
}

function Text({ absatz }: { absatz: Absatz }) {
  return (
    <p>
      {absatz.map((teil, i) => (typeof teil === 'string' ? teil : <strong key={i}>{teil.b}</strong>))}
    </p>
  )
}

/** Statischer Teil unter dem Rechner (Server Component): Methode, Annahmen, Regelstand und Quellen, Rechtliches. */
export function Hintergrund({ daten, sprache }: { daten: RegelDaten; sprache: Sprache }) {
  const t = woerterbuch(sprache)
  const H = t.hintergrund
  const stand = t.f.datum(daten.stand)
  return (
    <>
      <section className="sec hintergrund" id="methode" aria-labelledby="methode-titel">
        <div className="wrap faq-grid">
          <div>
            <h2 id="methode-titel">{H.methodeTitel}</h2>
            <p className="lead">{H.methodeLead}</p>
          </div>
          <div>
            <div className="fliesstext">
              {H.methode.map((absatz, i) => <Text key={i} absatz={absatz} />)}
            </div>
            <h3 className="annahmen-titel">{H.annahmenTitel}</h3>
            {H.annahmen.map((gruppe) => (
              <details key={gruppe.titel}>
                <summary>{gruppe.titel}</summary>
                <ul className="liste">
                  {gruppe.punkte.map((p) => <li key={p}>{p}</li>)}
                </ul>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="sec hintergrund" id="quellen" aria-labelledby="quellen-titel">
        <div className="wrap faq-grid">
          <div>
            <h2 id="quellen-titel">{H.quellenTitel}</h2>
            <p className="lead">{H.quellenLead(stand)}</p>
          </div>
          <div>
            {quellenJeFirma(daten).map(({ firma, quellen }) => (
              <details key={firma}>
                <summary>
                  {firma} <span className="anzahl">{H.quellenAnzahl(quellen.length)}</span>
                </summary>
                <ul className="quellen">
                  {quellen.map((q) => (
                    <li key={q.id}>
                      <a href={q.url} target="_blank" rel="noopener noreferrer nofollow">{t.daten.quelleTitel(q)}</a>
                      {q.abruf ? <span className="abruf"> · {H.abgerufen(t.f.datum(q.abruf))}</span> : null}
                    </li>
                  ))}
                </ul>
              </details>
            ))}
          </div>
        </div>
        <div className="wrap">
          <div className="rechtlich">
            {H.rechtlich.map((p) => <p key={p}>{p}</p>)}
          </div>
        </div>
      </section>
    </>
  )
}
