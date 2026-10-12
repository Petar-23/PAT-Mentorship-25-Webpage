'use client'

import { Fragment, useMemo, useState } from 'react'
import {
  baueZeilen, type Zeile,
} from '@/lib/prop-firm/auswertung'
import { FIRMEN, type KontoEintrag, type RegelDaten } from '@/lib/prop-firm/konten'
import type { RohErgebnis, SimEinstellungen } from '@/lib/prop-firm/simulation'
import { Details } from './details'
import { hauptgrund } from './scheitern'
import { woerterbuch, type Sprache, type Woerterbuch } from './texte'

export type Ergebnis = { roh: Record<string, RohErgebnis>; einst: SimEinstellungen; pfade: number; dauerMs: number; formSchl: string }

const GROESSEN = [
  { key: 'k10', passt: (g: number) => g <= 10000 },
  { key: 'k25', passt: (g: number) => g > 10000 && g <= 25000 },
  { key: 'k50', passt: (g: number) => g > 25000 && g <= 50000 },
  { key: 'k100', passt: (g: number) => g > 50000 && g <= 100000 },
  { key: 'k150', passt: (g: number) => g > 100000 },
] as const

/** So viele Zeilen zeigt die Tabelle zuerst; der Rest auf Knopfdruck (die Seite bleibt ruhig, sortiert ist ohnehin nach Netto). */
const ERSTE_ZEILEN = 25

type SortKey = 'rang' | 'fk30' | 'fk60' | 'fk90' | 'ausz6' | 'median' | 'bruch' | 'preis' | 'name'

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
    case 'preis': return z.eintrag.konto.preis
    case 'name': return `${z.eintrag.firma} ${String(z.eintrag.groesse).padStart(8, '0')} ${z.eintrag.programm} ${z.eintrag.variante}`
  }
}

/** Text der Regel-Variante, die den Rang bestimmt, in der Sprache der Seite. */
function rangVarianteText(z: Zeile, t: Woerterbuch): string | null {
  if (!z.rangVariante) return null
  const v = z.varianten.find((x) => x.text === z.rangVariante)
  return t.daten.regelVariante(v?.name ?? '', z.rangVariante)
}

/** Programm und Variante eines Kontotyps als Unterzeile. */
export function unterzeile(e: KontoEintrag, t: Woerterbuch): string {
  return `${e.programm}${e.variante ? `, ${t.daten.variante(e.variante)}` : ''}`
}

/** Ergebnisse: Vergleich ohne Kante, Kanten-Sicherheit, Top 3, Tabelle mit Filtern und Details. */
export function Ergebnisse({ ergebnis, eintraege, daten, veraltet, sprache }: {
  ergebnis: Ergebnis
  eintraege: KontoEintrag[]
  daten: RegelDaten
  veraltet: boolean
  sprache: Sprache
}) {
  const t = woerterbuch(sprache)
  const T = t.ergebnis
  const { usd, zahlText, pct, groesseKurz, r: rText, ka } = t.f
  const DATEN = daten
  const [firmen, setFirmen] = useState<Set<string>>(() => new Set(FIRMEN))
  const [groessen, setGroessen] = useState<Set<string>>(() => new Set(GROESSEN.map((g) => g.key)))
  const [nurAktiv, setNurAktiv] = useState(true)
  const [sort, setSort] = useState<{ key: SortKey; ab: boolean }>({ key: 'rang', ab: true })
  const [offen, setOffen] = useState<Set<string>>(() => new Set())
  const [alleZeilen, setAlleZeilen] = useState(false)
  const einstErg = ergebnis.einst

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
  const top = useMemo(
    () => zeilen.filter((z) => z.inRangfolge).sort((a, b) => (b.rangNetto as number) - (a.rangNetto as number)).slice(0, 3),
    [zeilen],
  )

  const sortiere = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, ab: !s.ab } : { key, ab: !['median', 'bruch', 'preis', 'name'].includes(key) }))
  const umschalten = <V,>(menge: Set<V>, wert: V, setzer: (s: Set<V>) => void) => {
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
  const S = T.spalten

  return (
    <section className="ergebnis" aria-label={T.alleTitel} data-veraltet={veraltet ? '' : undefined}>
      {top.length > 0 && (
        <>
          <h3 className="zwischen">{T.topTitel}</h3>
          <p className="klein unter">{T.topUnter}</p>
          <ol className="top">
            {top.map((z, i) => {
              const v = rangVarianteText(z, t)
              return (
                <li className="karte" key={z.eintrag.id}>
                  <span className="rang">{T.platz(i + 1)}</span>
                  <span className="name">
                    {z.eintrag.firma} {groesseKurz(z.eintrag.groesse)}
                    <small>{unterzeile(z.eintrag, t)}</small>
                  </span>
                  <span className={`wert num ${(z.rangNetto ?? 0) > 0 ? '' : 'minus'}`}>
                    {usd(z.rangNetto, true)} <small>{T.proMonatPlusMinus(zahlText((z.kante.netto?.se ?? 0) * 2))}</small>
                  </span>
                  <dl className="werte">
                    <div><dt>{T.bestehen60}</dt><dd>{z.eintrag.hatEval ? pct(z.kante.fk60) : T.ohnePruefung}</dd></div>
                    <div><dt>{T.ausz6}</dt><dd>{pct(z.kante.ausz6)}</dd></div>
                    <div><dt>{T.gesprengt12}</dt><dd>{pct(z.kante.bruch12)}</dd></div>
                  </dl>
                  <p className="top-grund">{hauptgrund(z.kante, t)}</p>
                  {v && <span className="klein">{T.gerechnetMit(v)}</span>}
                </li>
              )
            })}
          </ol>
        </>
      )}

      <div className="tabelle-kopf">
        <div>
          <h3 id="alle-titel">{T.alleTitel}</h3>
          <p className="klein">{T.angezeigt(zeilen.length, zeilenAlle.length, ausgeblendetBot)}</p>
        </div>
        <div className="filter">
          <div className="chips" role="group" aria-label={T.firmen}>
            {FIRMEN.map((f) => (
              <button key={f} type="button" aria-pressed={firmen.has(f)} onClick={() => umschalten(firmen, f, setFirmen)}>{f}</button>
            ))}
          </div>
          <div className="chips" role="group" aria-label={T.kontogroesse}>
            {GROESSEN.map((g) => (
              <button key={g.key} type="button" aria-pressed={groessen.has(g.key)} onClick={() => umschalten(groessen, g.key, setGroessen)}>{T.groessen[g.key]}</button>
            ))}
          </div>
          <label className="schalter schalter-kurz">
            <input type="checkbox" checked={nurAktiv} onChange={(ev) => setNurAktiv(ev.target.checked)} />
            <span>{T.nurAktiv}</span>
          </label>
        </div>
      </div>
      <p className="klein scroll-hinweis">{T.scrollHinweis}</p>

      <div className="tabelle-rahmen">
        <table>
          <thead>
            <tr>
              {thSort('name', S.name)}
              {thSort('preis', S.preis)}
              {thSort('fk30', S.fk30, S.fk30Titel)}
              {thSort('fk60', S.fk60)}
              {thSort('fk90', S.fk90)}
              {thSort('ausz6', S.ausz6, S.ausz6Titel)}
              {thSort('median', S.median, S.medianTitel)}
              {thSort('bruch', S.bruch, S.bruchTitel)}
              {thSort('rang', S.netto, S.nettoTitel)}
            </tr>
          </thead>
          <tbody>
            {zeilen.length === 0 && (
              <tr><td colSpan={9} className="leer">{T.leer}</td></tr>
            )}
            {(alleZeilen ? zeilen : zeilen.slice(0, ERSTE_ZEILEN)).map((z) => {
              const e = z.eintrag
              const k = z.kante
              const auf = offen.has(e.id)
              const toggle = () => umschalten(offen, e.id, setOffen)
              const M = T.marken
              return (
                <Fragment key={e.id}>
                  <tr className={`zeile${z.inRangfolge ? '' : ' aussen'}${auf ? ' offen' : ''}`} onClick={toggle}>
                    <td>
                      <button type="button" className="konto-name" aria-expanded={auf} onClick={(ev) => { ev.stopPropagation(); toggle() }}>
                        {e.firma} {groesseKurz(e.groesse)}
                        <small>{unterzeile(e, t)}</small>
                      </button>
                      {k.netto && (
                        <span className={`netto-mobil num ${k.netto.mittel > 0 ? 'plus' : 'minus'}`}>
                          {usd(k.netto.mittel, true)} {T.proMonatKurz}
                        </span>
                      )}
                      <div className="marken">
                        {e.perp && <span className="marke">{M.perps}</span>}
                        {!e.hatEval && <span className="marke">{M.ohnePruefung}</span>}
                        {e.evalStufen > 1 && <span className="marke">{M.stufen(e.evalStufen)}</span>}
                        {z.varianten.length > 0 && <span className="marke warn">{M.regelOffen}</span>}
                        {e.aktionen.length > 0 && <span className="marke">{M.aktion}</span>}
                        {!e.aktiv && <span className="marke warn">{M.nichtAngeboten}</span>}
                        {e.konto.preis === null && <span className="marke warn">{M.preisUnbekannt}</span>}
                        {z.politik !== einstErg.politik && <span className="marke">{M.wegA}</span>}
                        {z.grund && <span className="marke warn">{M.nichtRechenbar}</span>}
                      </div>
                    </td>
                    <td className="num">
                      {e.konto.preis === null ? ka : `${usd(e.konto.preis)}${e.konto.rhythmus === 'monatlich' ? T.preisMonat : ''}`}
                      {e.konto.aktivierung ? <span className="spanne">{T.aktivierung(usd(e.konto.aktivierung))}</span> : null}
                    </td>
                    <td>{e.hatEval ? pct(k.fk30) : '·'}</td>
                    <td>{e.hatEval ? pct(k.fk60) : '·'}</td>
                    <td>{e.hatEval ? pct(k.fk90) : '·'}</td>
                    <td>{pct(k.ausz6)}</td>
                    <td>{k.auszMedianHT !== null ? zahlText(k.auszMedianHT) : '·'}</td>
                    <td>{pct(k.bruch12)}</td>
                    <td>
                      {k.netto ? (
                        <>
                          <span className={k.netto.mittel > 0 ? 'plus' : 'minus'}>{usd(k.netto.mittel, true)}</span>
                          <span className="spanne">{T.spanne(usd(k.netto.p10, true), usd(k.netto.p90, true))}</span>
                          {z.rangVariante && z.rangNetto !== null && <span className="spanne">{T.vorsichtig(usd(z.rangNetto, true))}</span>}
                        </>
                      ) : T.preisUnbekannt}
                    </td>
                  </tr>
                  {auf && (
                    <tr className="details">
                      <td colSpan={9}>
                        <Details zeile={z} daten={DATEN} botBetrieb={einstErg.botBetrieb} sprache={sprache} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
      {zeilen.length > ERSTE_ZEILEN && (
        <div className="mehr">
          <button
            type="button"
            className="knopf-leise"
            aria-expanded={alleZeilen}
            onClick={() => {
              if (alleZeilen) document.getElementById('alle-titel')?.scrollIntoView({ block: 'start' })
              setAlleZeilen(!alleZeilen)
            }}
          >
            {alleZeilen ? T.weniger(ERSTE_ZEILEN) : T.mehr(zeilen.length)}
          </button>
        </div>
      )}
      <p className="klein legende">{T.legende}</p>
      {DATEN.nicht_simulierbar.length > 0 && (
        <p className="klein legende">
          {T.nichtGerechnet(DATEN.nicht_simulierbar.map((n) => `${n.firma} ${n.programm ?? ''} ${groesseKurz(n.groesse)}`).join(', '))}
        </p>
      )}
    </section>
  )
}
