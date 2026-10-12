'use client'

import { ENDEN, type Ende } from '@/lib/prop-firm/simulation'
import { Erklaerung, Wachsen } from './bewegung'
import { woerterbuch, type Sprache, type Woerterbuch } from './texte'

const FEHLER: readonly Ende[] = ['dd', 'dll', 'zeitlimit', 'inaktivitaet']

export type EndenAnteile = { endenEval: number[]; endenFunded: number[]; consHebt: number; consSperre: number }

type Posten = { schluessel: string; ende: Ende; phase: 'eval' | 'funded' | null; anteil: number; fehler: boolean }

/** Anteile je Ende als Liste: erst die Regeln, an denen Käufe scheitern (größte zuerst), dann die übrigen Ausgänge. */
export function posten(a: EndenAnteile): Posten[] {
  const fehler: Posten[] = []
  const rest: Posten[] = []
  ENDEN.forEach((ende, j) => {
    if (FEHLER.includes(ende)) {
      fehler.push({ schluessel: `${ende}-e`, ende, phase: 'eval', anteil: a.endenEval[j], fehler: true })
      fehler.push({ schluessel: `${ende}-f`, ende, phase: 'funded', anteil: a.endenFunded[j], fehler: true })
    } else {
      rest.push({ schluessel: ende, ende, phase: null, anteil: a.endenEval[j] + a.endenFunded[j], fehler: false })
    }
  })
  const sichtbar = (p: Posten) => p.anteil >= 0.005
  return [...fehler.filter(sichtbar).sort((x, y) => y.anteil - x.anteil), ...rest.filter(sichtbar).sort((x, y) => y.anteil - x.anteil)]
}

function name(p: Posten, t: Woerterbuch): string {
  const E = t.enden
  const basis = E.name[p.ende]
  return p.phase === null ? basis : `${basis} ${p.phase === 'eval' ? E.pruefung : E.funded}`
}

/** Häufigster Grund des Scheiterns als kurze Zeile (Top-Karten, Zusammenfassung). */
export function hauptgrund(a: EndenAnteile, t: Woerterbuch): string {
  const f = posten(a).filter((p) => p.fehler)
  if (!f.length) return t.enden.keinScheitern
  return t.enden.hauptgrund(name(f[0], t), t.f.pct(f[0].anteil))
}

/**
 * „Woran es scheitert“: Balken, der von links wächst, die Ausgänge mit Anteil, Erklärungen erst auf Wunsch.
 * kompakt: nur die drei größten Posten (Zusammenfassung oben).
 */
export function Scheitern({ anteile, sprache, titel = true, kompakt = false }: { anteile: EndenAnteile; sprache: Sprache; titel?: boolean; kompakt?: boolean }) {
  const t = woerterbuch(sprache)
  const E = t.enden
  const alle = posten(anteile)
  const liste = kompakt ? alle.slice(0, 3) : alle
  // Startpunkt je Segment (für die gestaffelte Verzögerung beim Wachsen)
  const starts = alle.map((_, i) => alle.slice(0, i).reduce((s, p) => s + p.anteil, 0))
  return (
    <div className={`scheitern${kompakt ? ' kompakt' : ''}`}>
      {titel && (
        <>
          <h4>{E.titel}</h4>
          {!kompakt && <p className="scheitern-unter">{E.unter}</p>}
        </>
      )}
      <div className="scheitern-balken" aria-hidden="true">
        {alle.map((p, i) => (
          <Wachsen key={p.schluessel} anteil={p.anteil} verzoegerung={0.05 + starts[i] * 0.35 + i * 0.02} klasse={p.fehler ? 'fehler' : `ok ${p.ende}`} />
        ))}
      </div>
      <ul>
        {liste.map((p) => (
          <li key={p.schluessel} className={p.fehler ? 'fehler' : `ok ${p.ende}`}>
            <span className="scheitern-zeile">
              <span>{name(p, t)}</span>
              <b className="num">{t.f.pct(p.anteil)}</b>
            </span>
          </li>
        ))}
      </ul>
      <Erklaerung titel={t.wz.wasHeisst} klasse="erkl-klein">
        <ul className="scheitern-erkl">
          {liste.map((p) => (
            <li key={p.schluessel}>
              <b>{name(p, t)}:</b> {E.erklaerung[p.ende]}
            </li>
          ))}
        </ul>
        {anteile.consHebt >= 0.005 && <p className="scheitern-notiz">{E.consHebt(t.f.pct(anteile.consHebt))}</p>}
        {anteile.consSperre >= 0.005 && <p className="scheitern-notiz">{E.consSperre(t.f.pct(anteile.consSperre))}</p>}
      </Erklaerung>
    </div>
  )
}
