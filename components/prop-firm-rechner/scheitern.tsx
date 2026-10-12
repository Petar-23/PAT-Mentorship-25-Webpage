import { ENDEN, type Ende } from '@/lib/prop-firm/simulation'
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

/** „Woran es scheitert“: Balken mit den Anteilen und je Ausgang ein Satz Erklärung. */
export function Scheitern({ anteile, sprache, titel = true }: { anteile: EndenAnteile; sprache: Sprache; titel?: boolean }) {
  const t = woerterbuch(sprache)
  const E = t.enden
  const liste = posten(anteile)
  return (
    <div className="scheitern">
      {titel && (
        <>
          <h4>{E.titel}</h4>
          <p className="scheitern-unter">{E.unter}</p>
        </>
      )}
      <div className="scheitern-balken" aria-hidden="true">
        {liste.map((p) => (
          <i key={p.schluessel} className={p.fehler ? 'fehler' : `ok ${p.ende}`} style={{ width: `${p.anteil * 100}%` }} />
        ))}
      </div>
      <ul>
        {liste.map((p) => (
          <li key={p.schluessel} className={p.fehler ? 'fehler' : `ok ${p.ende}`}>
            <span className="scheitern-zeile">
              <span>{name(p, t)}</span>
              <b className="num">{t.f.pct(p.anteil)}</b>
            </span>
            <small>{E.erklaerung[p.ende]}</small>
          </li>
        ))}
      </ul>
      {anteile.consHebt >= 0.005 && <p className="scheitern-notiz">{E.consHebt(t.f.pct(anteile.consHebt))}</p>}
      {anteile.consSperre >= 0.005 && <p className="scheitern-notiz">{E.consSperre(t.f.pct(anteile.consSperre))}</p>}
    </div>
  )
}
