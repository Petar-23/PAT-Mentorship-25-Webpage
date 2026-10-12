'use client'

import { useBeispiel, type BeispielZustand } from './beispiel'
import { START_ZAHLEN } from './start'
import { woerterbuch, type Sprache } from './texte'

/**
 * Rechte Spalte im Hero: Vorschau eines Ergebnisses mit den Startwerten, deutlich als Beispiel markiert.
 * Die Zahlen kommen aus der ersten Rechnung des Rechners (gleiche Werte wie im Ergebnis unten), bis dahin Platzhalter
 * in derselben Höhe. Zwei ruhige Balken: bester Kontotyp mit diesen Werten und bester Kontotyp ohne Kante.
 */
export function BeispielKarte({ sprache }: { sprache: Sprache }) {
  return <BeispielKarteAnsicht sprache={sprache} zustand={useBeispiel()} />
}

/** Reine Ansicht (ohne Speicher), damit sie sich auch gefüllt auf dem Server rendern und testen lässt. */
export function BeispielKarteAnsicht({ sprache, zustand: z }: { sprache: Sprache; zustand: BeispielZustand }) {
  const t = woerterbuch(sprache)
  const B = t.beispiel
  const { usd, groesseKurz } = t.f
  const w = z.status === 'fertig' ? z.wert : null
  const max = w ? Math.max(Math.abs(w.netto), Math.abs(w.ohneKante), 1) : 1
  const balken = (v: number | null) => {
    if (v === null) return { left: '50%', width: '0%' }
    const breite = (Math.abs(v) / max) * 50
    return { left: v >= 0 ? '50%' : `${50 - breite}%`, width: `${breite}%` }
  }
  const zeile = (text: string, v: number | null, klasse: string) => (
    <div className={`beispiel-zeile ${klasse}`}>
      <span className="beispiel-zeile-text">{text}</span>
      <span className={`beispiel-zeile-wert num ${v === null ? '' : v > 0 ? 'plus' : 'minus'}`}>{v === null ? '…' : `${usd(v, true)}`}</span>
      <span className="beispiel-spur" aria-hidden="true">
        <i style={balken(v)} />
      </span>
    </div>
  )
  return (
    <aside className="beispiel rise" aria-label={B.aria} aria-busy={z.status === 'rechnet'}>
      <div className="beispiel-kopf">
        <span className="beispiel-marke">{B.marke}</span>
        <span>{B.kopf}</span>
      </div>
      <p className="beispiel-annahmen">{B.annahmen(START_ZAHLEN)}</p>
      <div className="beispiel-best">
        <span className="beispiel-label">{B.besterTyp}</span>
        {w ? (
          <b>
            {w.firma} {groesseKurz(w.groesse)}
            <small>{`${w.programm}${w.variante ? `, ${t.daten.variante(w.variante)}` : ''}`}</small>
          </b>
        ) : (
          <b className="beispiel-warte">
            {z.status === 'abgebrochen' ? B.abgebrochen : B.rechnet}
            <small>&nbsp;</small>
          </b>
        )}
      </div>
      <p className="beispiel-wert">
        <b className="num">{w ? usd(w.netto, true) : '…'}</b>
        <span>{B.proMonat}</span>
      </p>
      <div className="beispiel-vergleich">
        {zeile(B.mitKante, w ? w.netto : null, 'mit')}
        {zeile(B.ohneKante, w ? w.ohneKante : null, 'ohne')}
        <p className="beispiel-abstand">{w ? B.abstand(usd(w.netto - w.ohneKante)) : ' '}</p>
      </div>
      <p className="beispiel-fuss">
        {B.fuss}{' '}
        <a className="lnk" href="#rechner">
          {B.link}
        </a>
      </p>
    </aside>
  )
}
