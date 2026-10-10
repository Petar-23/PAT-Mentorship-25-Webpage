'use client'

import { Fragment, useMemo, useState } from 'react'
import {
  baueZeilen, gluecksvergleich, kantenSicherheit, type Zeile,
} from '@/lib/prop-firm/auswertung'
import { FIRMEN, type KontoEintrag, type RegelDaten } from '@/lib/prop-firm/konten'
import type { RohErgebnis, SimEinstellungen } from '@/lib/prop-firm/simulation'
import { Details } from './details'
import { POLITIK_TEXT, groesseKurz, pct, r as rText, usd, zahlText } from './texte'

export type Ergebnis = { roh: Record<string, RohErgebnis>; einst: SimEinstellungen; pfade: number; dauerMs: number; formSchl: string }

const GROESSEN = [
  { key: 'k10', text: 'bis 10K', passt: (g: number) => g <= 10000 },
  { key: 'k25', text: '20K bis 25K', passt: (g: number) => g > 10000 && g <= 25000 },
  { key: 'k50', text: '50K', passt: (g: number) => g > 25000 && g <= 50000 },
  { key: 'k100', text: '100K', passt: (g: number) => g > 50000 && g <= 100000 },
  { key: 'k150', text: 'ab 150K', passt: (g: number) => g > 100000 },
] as const

type SortKey = 'rang' | 'fk30' | 'fk60' | 'fk90' | 'ausz6' | 'median' | 'bruch' | 'null' | 'preis' | 'name'

function sortWert(z: Zeile, key: SortKey): number | string | null {
  const k = z.kante
  switch (key) {
    case 'rang': return z.rangNetto
    case 'fk30': return k.fk30
    case 'fk60': return k.fk60
    case 'fk90': return k.fk90
    case 'ausz6': return k.ausz6
    case 'median': return k.auszMedianHT
    case 'bruch': return k.bruch12
    case 'null': return z.rangNull
    case 'preis': return z.eintrag.konto.preis
    case 'name': return `${z.eintrag.firma} ${String(z.eintrag.groesse).padStart(8, '0')} ${z.eintrag.programm} ${z.eintrag.variante}`
  }
}

/** Ergebnisse: Glücksvergleich, Kanten-Sicherheit, Top 3, Tabelle mit Filtern und Details. */
export function Ergebnisse({ ergebnis, eintraege, daten, veraltet }: {
  ergebnis: Ergebnis
  eintraege: KontoEintrag[]
  daten: RegelDaten
  veraltet: boolean
}) {
  const DATEN = daten
  const [firmen, setFirmen] = useState<Set<string>>(() => new Set(FIRMEN))
  const [groessen, setGroessen] = useState<Set<string>>(() => new Set(GROESSEN.map((g) => g.key)))
  const [nurAktiv, setNurAktiv] = useState(true)
  const [sort, setSort] = useState<{ key: SortKey; ab: boolean }>({ key: 'rang', ab: true })
  const [offen, setOffen] = useState<Set<string>>(() => new Set())
  const einstErg = ergebnis.einst
  const sicherheitErg = kantenSicherheit(einstErg.strom)

  const zeilenAlle = useMemo(() => baueZeilen(eintraege, ergebnis.roh, einstErg.botBetrieb), [ergebnis, eintraege, einstErg])
  const ausgeblendetBot = einstErg.botBetrieb ? zeilenAlle.filter((z) => z.eintrag.botAusschluss).length : 0
  const zeilen = useMemo(() => {
    const gw = GROESSEN.filter((g) => groessen.has(g.key))
    const f = zeilenAlle.filter((z) =>
      firmen.has(z.eintrag.firma) && gw.some((g) => g.passt(z.eintrag.groesse)) && (!nurAktiv || z.eintrag.aktiv) &&
      !(einstErg.botBetrieb && z.eintrag.botAusschluss))
    const dir = sort.ab ? -1 : 1
    return [...f].sort((a, b) => {
      const x = sortWert(a, sort.key)
      const y = sortWert(b, sort.key)
      if (x === null && y === null) return 0
      if (x === null) return 1
      if (y === null) return -1
      if (typeof x === 'string' || typeof y === 'string') return String(x).localeCompare(String(y)) * dir
      return (x - y) * dir
    })
  }, [zeilenAlle, firmen, groessen, nurAktiv, sort, einstErg])
  const glueck = useMemo(() => gluecksvergleich(zeilen), [zeilen])
  const top = useMemo(
    () => zeilen.filter((z) => z.inRangfolge).sort((a, b) => (b.rangNetto as number) - (a.rangNetto as number)).slice(0, 3),
    [zeilen],
  )

  const sortiere = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, ab: !s.ab } : { key, ab: !['median', 'bruch', 'preis', 'name'].includes(key) }))
  const umschalten = <T,>(menge: Set<T>, wert: T, setzer: (s: Set<T>) => void) => {
    const n = new Set(menge)
    if (n.has(wert)) n.delete(wert)
    else n.add(wert)
    setzer(n)
  }
  const thSort = (key: SortKey, text: string, titel?: string) => (
    <th aria-sort={sort.key === key ? (sort.ab ? 'descending' : 'ascending') : 'none'} title={titel}>
      <button type="button" onClick={() => sortiere(key)}>{text}</button>
    </th>
  )

  return (
    <section className="wrap abschnitt" aria-labelledby="ergebnis-titel" style={veraltet ? { opacity: 0.6 } : undefined}>
      <h2 id="ergebnis-titel">Ergebnis</h2>
      <p className="unter">
        {zahlText(ergebnis.pfade)} simulierte Jahre je Kontotyp, Auszahlungsweg „{POLITIK_TEXT[einstErg.politik].name}“
        {einstErg.politik !== 'A' ? ` mit ${einstErg.politikFaktor}x Drawdown Polster` : ''}
        {einstErg.botBetrieb ? ', Handel per Bot' : ''}. Netto pro Monat heißt: alle Auszahlungen nach Split minus alle
        Gebühren (Kauf, Abo, Reset, Aktivierung, Fixkosten) über zwölf Monate, mit Nachkauf nach jedem verlorenen Konto.
      </p>

      <div className="ehrlich">
        <div className="panel karte">
          <h3>So sähe es mit reinem Glück aus</h3>
          <dl className="vergleich">
            <div>
              <dt>Bester Kontotyp mit deinen Werten<small>{glueck.bestKanteZeile ? `${glueck.bestKanteZeile.eintrag.firma} ${groesseKurz(glueck.bestKanteZeile.eintrag.groesse)}, ${glueck.bestKanteZeile.eintrag.programm}` : 'keiner mit Preis in der Auswahl'}</small></dt>
              <dd className={(glueck.bestKante ?? 0) > 0 ? 'plus' : 'minus'}>{glueck.bestKante !== null ? `${usd(glueck.bestKante, true)} / Monat` : 'k. A.'}</dd>
            </div>
            <div>
              <dt>Bester Kontotyp mit Kante 0<small>gleiche Trades und Streuung, Erwartung je Trade genau null</small></dt>
              <dd className={(glueck.bestNull ?? 0) > 0 ? 'plus' : 'minus'}>{glueck.bestNull !== null ? `${usd(glueck.bestNull, true)} / Monat` : 'k. A.'}</dd>
            </div>
            <div>
              <dt>Mittel über alle {glueck.n} Kontotypen mit Kante 0<small>Ohne echte Kante gehen über viele Konten die Gebühren verloren.</small></dt>
              <dd className={(glueck.mittelNull ?? 0) > 0 ? 'plus' : 'minus'}>{glueck.mittelNull !== null ? `${usd(glueck.mittelNull, true)} / Monat` : 'k. A.'}</dd>
            </div>
          </dl>
          <p className="urteil">{urteil(glueck, sicherheitErg.erwartung)}</p>
        </div>
        <div className="panel karte">
          <h3>Wie sicher ist deine Kante?</h3>
          <p className="klein" style={{ fontSize: 14.5, color: 'var(--text-2)' }}>
            Deine Eingaben ergeben {rText(sicherheitErg.erwartung)} je Trade bei einer Streuung von {rText(sicherheitErg.sd, false)}.
            {sicherheitErg.tradesNoetig
              ? ` Aus 100 Trades geschätzt, kann die echte Erwartung irgendwo zwischen ${rText(sicherheitErg.erwartung - sicherheitErg.band100)} und ${rText(sicherheitErg.erwartung + sicherheitErg.band100)} liegen. Erst ab rund ${zahlText(sicherheitErg.tradesNoetig)} Trades ist sie mit 95 % Sicherheit größer als null.`
              : ' Ohne positive Erwartung ist jedes Plus Glück. Über viele Konten gehen dann die Gebühren verloren.'}
          </p>
          <p className="klein" style={{ marginTop: 10 }}>
            Deine Trefferquote und deine R-Werte sind selbst Schätzungen. Stammen sie aus wenigen Trades oder aus einem
            Backtest, der nach dem Ergebnis ausgesucht wurde, ist ein Teil davon Glück. Der Rechner kann nur so gut
            sein wie diese Zahlen.
          </p>
        </div>
      </div>

      {top.length > 0 && (
        <>
          <h3 style={{ marginTop: 34 }}>Die drei besten Kontotypen für deine Eingaben</h3>
          <p className="unter klein">
            Sortiert nach Netto pro Monat in der vorsichtigeren Lesart, wenn eine Regel der Firma nicht eindeutig ist.
            Der beste Wert aus vielen Kontotypen ist immer etwas zu gut geschätzt: Auch die Simulation streut (± Angabe).
          </p>
          <div className="top">
            {top.map((z, i) => (
              <div className="panel karte" key={z.eintrag.id}>
                <span className="rang">Platz {i + 1}</span>
                <span className="name">
                  {z.eintrag.firma} {groesseKurz(z.eintrag.groesse)}
                  <small>{z.eintrag.programm}{z.eintrag.variante ? `, ${z.eintrag.variante}` : ''}</small>
                </span>
                <span className="wert num">
                  {usd(z.rangNetto, true)} <small>pro Monat, ± {zahlText((z.kante.netto?.se ?? 0) * 2)} USD</small>
                </span>
                <div className="werte">
                  <span>Bestehen in 60 Handelstagen<b>{z.eintrag.hatEval ? pct(z.kante.fk60) : 'ohne Prüfung'}</b></span>
                  <span>Erste Auszahlung in 6 Monaten<b>{pct(z.kante.ausz6)}</b></span>
                  <span>Mit Kante 0<b className={(z.rangNull ?? 0) > 0 ? 'plus' : 'minus'}>{usd(z.rangNull, true)}</b></span>
                  <span>Gesprengt in 12 Monaten<b>{pct(z.kante.bruch12)}</b></span>
                </div>
                {z.rangVariante && <span className="klein">Gerechnet mit: {z.rangVariante}.</span>}
              </div>
            ))}
          </div>
        </>
      )}

      <div className="tabelle-kopf">
        <div>
          <h3>Alle Kontotypen</h3>
          <p className="klein">
            {zeilen.length} von {zeilenAlle.length} Kontotypen angezeigt
            {ausgeblendetBot ? `, ${ausgeblendetBot} ausgeblendet (Firma erlaubt keine Bots)` : ''}. Zeile antippen für Regeln, Kosten und Quellen.
          </p>
        </div>
        <div className="filter">
          <div className="chips" role="group" aria-label="Firmen">
            {FIRMEN.map((f) => (
              <button key={f} type="button" aria-pressed={firmen.has(f)} onClick={() => umschalten(firmen, f, setFirmen)}>{f}</button>
            ))}
          </div>
          <div className="chips" role="group" aria-label="Kontogröße">
            {GROESSEN.map((g) => (
              <button key={g.key} type="button" aria-pressed={groessen.has(g.key)} onClick={() => umschalten(groessen, g.key, setGroessen)}>{g.text}</button>
            ))}
          </div>
          <label className="schalter" style={{ marginBottom: 0 }}>
            <input type="checkbox" checked={nurAktiv} onChange={(ev) => setNurAktiv(ev.target.checked)} />
            <span>nur aktuell angebotene</span>
          </label>
        </div>
      </div>
      <div className="mobil-sort chips" role="group" aria-label="Sortieren nach" style={{ marginBottom: 4 }}>
        {([['rang', 'Netto'], ['fk60', 'Bestehen'], ['ausz6', 'Auszahlung'], ['bruch', 'Gesprengt'], ['preis', 'Preis']] as [SortKey, string][]).map(([k, t]) => (
          <button key={k} type="button" aria-pressed={sort.key === k} onClick={() => sortiere(k)}>{t}{sort.key === k ? (sort.ab ? ' ↓' : ' ↑') : ''}</button>
        ))}
      </div>

      <div className="tabelle-rahmen">
      <table>
        <thead>
          <tr>
            {thSort('name', 'Kontotyp')}
            {thSort('preis', 'Preis')}
            {thSort('fk30', 'Bestehen ≤ 30 HT', 'Anteil der Käufe, die die Prüfung in höchstens 30 Handelstagen bestehen')}
            {thSort('fk60', '≤ 60 HT')}
            {thSort('fk90', '≤ 90 HT')}
            {thSort('ausz6', '1. Auszahlung ≤ 6 Mon.', 'Ein Kauf: Anteil mit erster Auszahlung innerhalb von 6 Monaten')}
            {thSort('median', 'HT bis 1. Auszahlung', 'Median der Handelstage ab Kauf, nur Käufe mit Auszahlung')}
            {thSort('bruch', 'Gesprengt', 'Ein Kauf: Anteil verlorener Konten in 12 Monaten')}
            {thSort('rang', 'Netto / Monat', 'Konto-Platz über 12 Monate mit Nachkauf, alle Gebühren. Darunter: 10 % bis 90 % der Jahre')}
            {thSort('null', 'Kante 0', 'Dasselbe mit reinem Glück: Erwartung je Trade null')}
          </tr>
        </thead>
        <tbody>
          {zeilen.length === 0 && (
            <tr><td colSpan={10} className="leer">Keine Kontotypen in dieser Auswahl.</td></tr>
          )}
          {zeilen.map((z) => {
            const e = z.eintrag
            const k = z.kante
            const auf = offen.has(e.id)
            const toggle = () => umschalten(offen, e.id, setOffen)
            return (
              <Fragment key={e.id}>
                <tr className={`zeile${z.inRangfolge ? '' : ' aussen'}`} onClick={toggle}>
                  <td data-label="Kontotyp">
                    <button type="button" className="konto-name" aria-expanded={auf} onClick={(ev) => { ev.stopPropagation(); toggle() }} style={{ appearance: 'none', border: 0, background: 'none', padding: 0, textAlign: 'left', cursor: 'pointer', font: 'inherit' }}>
                      {e.firma} {groesseKurz(e.groesse)}
                      <small>{e.programm}{e.variante ? `, ${e.variante}` : ''}</small>
                    </button>
                    <div>
                      {e.perp && <span className="marke">Perps</span>}
                      {!e.hatEval && <span className="marke">ohne Prüfung</span>}
                      {e.evalStufen > 1 && <span className="marke">{e.evalStufen} Prüfungsstufen</span>}
                      {z.varianten.length > 0 && <span className="marke warn">Regel offen</span>}
                      {e.aktionen.length > 0 && <span className="marke">Aktion</span>}
                      {!e.aktiv && <span className="marke warn">nicht mehr angeboten</span>}
                      {e.konto.preis === null && <span className="marke warn">Preis unbekannt</span>}
                      {z.politik !== einstErg.politik && <span className="marke">Weg A gerechnet</span>}
                      {z.grund && <span className="marke warn">nicht rechenbar</span>}
                    </div>
                  </td>
                  <td data-label="Preis" className="num">
                    {e.konto.preis === null ? 'k. A.' : `${usd(e.konto.preis)}${e.konto.rhythmus === 'monatlich' ? ' / Monat' : ''}`}
                    {e.konto.aktivierung ? <span className="spanne">+ {usd(e.konto.aktivierung)} Aktivierung</span> : null}
                  </td>
                  <td data-label="Bestehen ≤ 30 HT">{e.hatEval ? pct(k.fk30) : '·'}</td>
                  <td data-label="Bestehen ≤ 60 HT">{e.hatEval ? pct(k.fk60) : '·'}</td>
                  <td data-label="Bestehen ≤ 90 HT">{e.hatEval ? pct(k.fk90) : '·'}</td>
                  <td data-label="1. Auszahlung ≤ 6 Mon.">{pct(k.ausz6)}</td>
                  <td data-label="HT bis 1. Auszahlung">{k.auszMedianHT !== null ? zahlText(k.auszMedianHT) : '·'}</td>
                  <td data-label="Gesprengt (12 Mon.)">{pct(k.bruch12)}</td>
                  <td data-label="Netto / Monat">
                    {k.netto ? (
                      <>
                        <span className={k.netto.mittel > 0 ? 'plus' : 'minus'}>{usd(k.netto.mittel, true)}</span>
                        <span className="spanne">{usd(k.netto.p10, true)} bis {usd(k.netto.p90, true)}</span>
                        {z.rangVariante && z.rangNetto !== null && <span className="spanne">vorsichtig {usd(z.rangNetto, true)}</span>}
                      </>
                    ) : 'Preis unbekannt'}
                  </td>
                  <td data-label="Kante 0 (Glück)">
                    {z.null.netto ? <span className={z.null.netto.mittel > 0 ? 'plus' : 'minus'}>{usd(z.null.netto.mittel, true)}</span> : '·'}
                  </td>
                </tr>
                {auf && (
                  <tr className="details">
                    <td colSpan={10}>
                      <Details zeile={z} daten={DATEN} botBetrieb={einstErg.botBetrieb} />
                    </td>
                  </tr>
                )}
              </Fragment>
            )
          })}
        </tbody>
      </table>
      </div>
      <p className="klein" style={{ marginTop: 12 }}>
        HT = Handelstage ab Kauf. Grau: nicht in der Rangfolge (nicht mehr angeboten, Preis unbekannt oder für Bots
        ausgeschlossen). „Regel offen“: Die Firma nennt zwei Werte, für die Rangfolge zählt der ungünstigere.
      </p>
      {DATEN.nicht_simulierbar.length > 0 && (
        <p className="klein" style={{ marginTop: 8 }}>
          Nicht gerechnet: {DATEN.nicht_simulierbar.map((n) => `${n.firma} ${n.programm ?? ''} ${groesseKurz(n.groesse)}`).join(', ')} (Sonderregeln, die der Rechner nicht abbildet).
        </p>
      )}
    </section>
  )
}

function urteil(g: ReturnType<typeof gluecksvergleich>, erwartung: number): string {
  if (g.bestKante === null || g.bestNull === null) return 'In dieser Auswahl gibt es keinen Kontotyp mit bekanntem Preis.'
  if (erwartung <= 0) {
    return 'Deine Eingaben haben keine positive Kante. Was hier im Plus steht, ist Glück. Über viele Konten gehen die Gebühren verloren.'
  }
  const abstand = g.bestKante - g.bestNull
  if (abstand <= 0) {
    return 'Dein bester Wert liegt nicht über dem besten Wert mit reinem Glück. Mit diesen Eingaben ist das Ergebnis von Glück nicht zu unterscheiden.'
  }
  let s = `Dein bester Kontotyp liegt ${usd(abstand)} pro Monat über dem besten Kontotyp mit reinem Glück. Nur dieser Abstand kommt aus deiner Kante, und nur, wenn deine Trefferquote und deine R-Werte stimmen.`
  if (g.bestNull > 0) {
    s += ' Dass auch mit Kante 0 ein Kontotyp leicht im Plus liegt, kommt aus den vereinfachten Annahmen (sofortige Auszahlung, keine Ablehnung durch die Firma) und der Streuung der Simulation, nicht aus einer Strategie.'
  }
  return s
}
