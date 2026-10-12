'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import rohDaten from '@/lib/prop-firm/daten/regeln-2026-10-09.json'
import { ladeKonten, type RegelDaten } from '@/lib/prop-firm/konten'
import { kantenSicherheit, schluesselFuer, verbinde } from '@/lib/prop-firm/auswertung'
import type { RohErgebnis, SimEinstellungen } from '@/lib/prop-firm/simulation'
import { PUNKTWERT, type Streuung } from '@/lib/prop-firm/stroeme'
import { Ergebnisse, type Ergebnis } from './ergebnisse'
import { woerterbuch, type Sprache, type Woerterbuch } from './texte'

const DATEN = rohDaten as unknown as RegelDaten
const SAAT = 20261009

type Form = {
  trefferquote: string
  gewinnR: string
  verlustR: string
  tradesProWoche: string
  streuung: Streuung
  groessenModus: 'risiko' | 'kontrakte' | 'dd_anteil'
  risikoUsd: string
  instrument: 'MNQ' | 'NQ'
  stopPunkte: string
  kontrakte: string
  ddAnteil: string
  politik: 'A' | 'B' | 'C'
  politikFaktor: 1 | 2
  botBetrieb: boolean
  perpKosten: boolean
  pfade: number
}

/** Startwerte; nur das Dezimalzeichen hängt an der Sprache, die Zahlen sind gleich. */
function startWerte(t: Woerterbuch): Form {
  return {
    trefferquote: '45', gewinnR: t.eingaben.startGewinnR, verlustR: '1', tradesProWoche: '5', streuung: 'gemischt', groessenModus: 'risiko',
    risikoUsd: '200', instrument: 'MNQ', stopPunkte: '20', kontrakte: '3', ddAnteil: '10', politik: 'A', politikFaktor: 1,
    botBetrieb: false, perpKosten: true, pfade: 1000,
  }
}

/** Eingabe -> Zahl. Deutsch: Komma ist das Dezimalzeichen. Englisch: Punkt, Komma trennt Tausender. */
function zahlAus(s: string, sprache: Sprache): number {
  const t = String(s).replace(/\s/g, '')
  return Number(sprache === 'de' ? t.replace(',', '.') : t.replace(/,/g, ''))
}

/** Startwerte je Sprache, einmal beim Laden des Moduls. */
const STARTS: Record<Sprache, Form> = { de: startWerte(woerterbuch('de')), en: startWerte(woerterbuch('en')) }

function pruefe(f: Form, t: Woerterbuch): { einst: SimEinstellungen | null; fehler: string[] } {
  const fehler: string[] = []
  const z = (s: string) => zahlAus(s, t.sprache)
  const p = z(f.trefferquote)
  const w = z(f.gewinnR)
  const l = z(f.verlustR)
  const tw = z(f.tradesProWoche)
  const risiko = z(f.risikoUsd)
  const stop = z(f.stopPunkte)
  const k = z(f.kontrakte)
  const dd = z(f.ddAnteil)
  const F = t.eingaben.fehler
  if (!(p >= 1 && p <= 99)) fehler.push(F.trefferquote)
  if (!(w > 0 && w <= 20)) fehler.push(F.gewinn)
  if (!(l > 0 && l <= 5)) fehler.push(F.verlust)
  if (!(tw >= 0.2 && tw <= 60)) fehler.push(F.trades)
  if (!(stop >= 1 && stop <= 500)) fehler.push(F.stopp)
  if (f.groessenModus === 'risiko' && !(risiko >= 1 && risiko <= 100000)) fehler.push(F.risiko)
  if (f.groessenModus === 'kontrakte' && !(Number.isInteger(k) && k >= 1 && k <= 200)) fehler.push(F.kontrakte)
  if (f.groessenModus === 'dd_anteil' && !(dd >= 1 && dd <= 100)) fehler.push(F.dd)
  if (fehler.length) return { einst: null, fehler }
  return {
    fehler,
    einst: {
      strom: { trefferquote: p / 100, gewinnR: w, verlustR: l, tradesProWoche: tw, streuung: f.streuung, stopPunkte: stop, instrument: f.instrument, nqKurs: 20000 },
      groessenModus: f.groessenModus, risikoUsd: risiko, kontrakte: k, ddAnteil: dd / 100, politik: f.politik,
      politikFaktor: f.politikFaktor, botBetrieb: f.botBetrieb, perpKosten: f.perpKosten, saat: SAAT,
    },
  }
}

type Lauf = { status: 'leer' | 'laeuft' | 'fertig' | 'fehler'; fertig: number; gesamt: number; fehler?: string }

export function PropFirmRechner({ sprache }: { sprache: Sprache }) {
  const t = woerterbuch(sprache)
  const E = t.eingaben
  const { usd, zahlText, r: rText } = t.f
  const START = STARTS[sprache]
  const eintraege = useMemo(() => ladeKonten(DATEN), [])
  const alleSchluessel = useMemo(() => eintraege.flatMap((e) => e.rechnungen.map((r) => schluesselFuer(e.id, r.name))), [eintraege])
  const [form, setForm] = useState<Form>(START)
  const [lauf, setLauf] = useState<Lauf>({ status: 'laeuft', fertig: 0, gesamt: START.pfade })
  const [ergebnis, setErgebnis] = useState<Ergebnis | null>(null)
  const workers = useRef<Worker[]>([])
  const laufId = useRef(0)

  const geprueft = useMemo(() => pruefe(form, woerterbuch(sprache)), [form, sprache])
  const formSchl = JSON.stringify(form)
  const veraltet = ergebnis !== null && ergebnis.formSchl !== formSchl

  const setze = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }))

  const beende = useCallback(() => {
    for (const w of workers.current) w.terminate()
    workers.current = []
  }, [])

  /** Verteilt die Pfade auf Worker. Setzt Zustand nur in den Rückrufen der Worker (asynchron). */
  const rechne = useCallback(
    (einst: SimEinstellungen, pfade: number, schl: string) => {
      const anzahl = Math.max(1, Math.min((typeof navigator !== 'undefined' && navigator.hardwareConcurrency) || 4, 8) - 1)
      if (workers.current.length !== anzahl) {
        beende()
        for (let i = 0; i < anzahl; i++) {
          const w = new Worker(new URL('../../lib/prop-firm/rechner.worker.ts', import.meta.url))
          w.postMessage({ typ: 'daten', daten: DATEN })
          workers.current.push(w)
        }
      }
      const id = ++laufId.current
      const t0 = performance.now()
      const teile: (Record<string, RohErgebnis> | null)[] = new Array(anzahl).fill(null)
      const stand = new Array<number>(anzahl).fill(0)
      const schritt = Math.ceil(pfade / anzahl)
      workers.current.forEach((w, i) => {
        const von = Math.min(i * schritt, pfade)
        const bis = Math.min(von + schritt, pfade)
        w.onmessage = (ev: MessageEvent) => {
          const m = ev.data as { typ: string; id: number; fertig?: number; roh?: Record<string, RohErgebnis>; text?: string }
          if (m.id !== id) return
          if (m.typ === 'fortschritt') {
            stand[i] = m.fertig as number
            setLauf({ status: 'laeuft', fertig: stand.reduce((a, b) => a + b, 0), gesamt: pfade })
          } else if (m.typ === 'fertig') {
            teile[i] = m.roh as Record<string, RohErgebnis>
            stand[i] = bis - von
            if (teile.every((x) => x !== null)) {
              setErgebnis({ roh: verbinde(teile as Record<string, RohErgebnis>[]), einst, pfade, dauerMs: performance.now() - t0, formSchl: schl })
              setLauf({ status: 'fertig', fertig: pfade, gesamt: pfade })
            }
          } else if (m.typ === 'fehler') {
            setLauf({ status: 'fehler', fertig: 0, gesamt: pfade, fehler: m.text })
          }
        }
        w.onerror = () => setLauf({ status: 'fehler', fertig: 0, gesamt: pfade, fehler: woerterbuch(sprache).eingaben.workerAbbruch })
        w.postMessage({ typ: 'auftrag', id, einst, schluessel: alleSchluessel, von, bis })
      })
    },
    [beende, alleSchluessel, sprache],
  )

  const starte = () => {
    const { einst } = pruefe(form, t)
    if (!einst) return
    if (lauf.status === 'laeuft') beende()
    setLauf({ status: 'laeuft', fertig: 0, gesamt: form.pfade })
    rechne(einst, form.pfade, formSchl)
  }

  // Erste Rechnung mit den Startwerten (Zustand steht schon auf „läuft“); beim Verlassen Worker beenden.
  // Im Strict Mode läuft das zweimal: Aufräumen beendet die Worker, der zweite Lauf startet frisch.
  useEffect(() => {
    const start = STARTS[sprache]
    const { einst } = pruefe(start, woerterbuch(sprache))
    if (einst) rechne(einst, start.pfade, JSON.stringify(start))
    return beende
  }, [rechne, beende, sprache])

  const sicherheit = geprueft.einst ? kantenSicherheit(geprueft.einst.strom) : null

  const kontrakteBeiRisiko = geprueft.einst
    ? Math.floor(geprueft.einst.risikoUsd / (geprueft.einst.strom.stopPunkte * PUNKTWERT[geprueft.einst.strom.instrument]))
    : 0
  const risikoBeiKontrakten = geprueft.einst
    ? geprueft.einst.kontrakte * geprueft.einst.strom.stopPunkte * PUNKTWERT[geprueft.einst.strom.instrument]
    : 0

  return (
    <>
      <section className="wrap rechner" id="rechner" aria-labelledby="eingaben-titel">
        <h2 id="eingaben-titel" className="sr-only">{E.titel}</h2>
        <form
          className="tafel eingaben"
          onSubmit={(ev) => {
            ev.preventDefault()
            starte()
          }}
        >
          <div className="eingaben-grid">
            <fieldset>
              <legend>{E.trades}</legend>
              <Feld label={E.trefferquote} einheit="%" wert={form.trefferquote} onChange={(v) => setze('trefferquote', v)} />
              <div className="zwei">
                <Feld label={E.gewinn} einheit="R" wert={form.gewinnR} onChange={(v) => setze('gewinnR', v)} />
                <Feld label={E.verlust} einheit="R" wert={form.verlustR} onChange={(v) => setze('verlustR', v)} />
              </div>
              <p className="hilfe hilfe-r">{E.rHinweis}</p>
              <Feld label={E.tradesProWoche} wert={form.tradesProWoche} onChange={(v) => setze('tradesProWoche', v)} />
              <div className="feld">
                <span id="streuung-l">{E.gewinner}</span>
                <Wahl
                  label="streuung-l"
                  wert={form.streuung}
                  onChange={(v) => setze('streuung', v)}
                  optionen={[
                    ['gleich', E.streuung.gleich],
                    ['gemischt', E.streuung.gemischt],
                    ['wenige_grosse', E.streuung.wenige_grosse],
                  ]}
                />
                <span className="hilfe">{E.streuungHilfe}</span>
              </div>
            </fieldset>

            <fieldset>
              <legend>{E.groesse}</legend>
              <div className="feld">
                <span id="modus-l">{E.groesseUeber}</span>
                <Wahl
                  label="modus-l"
                  wert={form.groessenModus}
                  onChange={(v) => setze('groessenModus', v)}
                  optionen={[
                    ['risiko', E.modus.risiko],
                    ['kontrakte', E.modus.kontrakte],
                    ['dd_anteil', E.modus.dd_anteil],
                  ]}
                />
              </div>
              {form.groessenModus === 'risiko' && (
                <Feld label={E.risiko} einheit="USD" wert={form.risikoUsd} onChange={(v) => setze('risikoUsd', v)} />
              )}
              {form.groessenModus === 'kontrakte' && (
                <Feld label={E.kontrakte} wert={form.kontrakte} onChange={(v) => setze('kontrakte', v)} />
              )}
              {form.groessenModus === 'dd_anteil' && (
                <Feld label={E.ddAnteil} einheit="%" wert={form.ddAnteil} onChange={(v) => setze('ddAnteil', v)} hilfe={E.ddHilfe} />
              )}
              <div className="zwei">
                <div className="feld">
                  <span id="instr-l">{E.instrument}</span>
                  <Wahl label="instr-l" wert={form.instrument} onChange={(v) => setze('instrument', v)} optionen={[['MNQ', 'MNQ'], ['NQ', 'NQ']]} />
                </div>
                <Feld label={E.stopp} einheit={E.punkte} wert={form.stopPunkte} onChange={(v) => setze('stopPunkte', v)} />
              </div>
              {geprueft.einst && form.groessenModus === 'risiko' && (
                <p className="hilfe">
                  {E.futuresHinweis(
                    kontrakteBeiRisiko,
                    form.instrument,
                    usd(kontrakteBeiRisiko * geprueft.einst.strom.stopPunkte * PUNKTWERT[form.instrument]),
                    usd(geprueft.einst.risikoUsd),
                  )}
                </p>
              )}
              {geprueft.einst && form.groessenModus === 'kontrakte' && <p className="hilfe">{E.kontrakteHinweis(usd(risikoBeiKontrakten))}</p>}
              {geprueft.einst && form.groessenModus === 'risiko' && kontrakteBeiRisiko === 0 && <p className="warnung">{E.keinKontrakt}</p>}
            </fieldset>

            <fieldset>
              <legend>{E.rahmen}</legend>
              <div className="feld">
                <span id="politik-l">{E.weg}</span>
                <Wahl
                  label="politik-l"
                  wert={form.politik}
                  onChange={(v) => setze('politik', v)}
                  optionen={[
                    ['A', `A: ${t.politik.A.name}`],
                    ['B', `B: ${t.politik.B.name}`],
                    ['C', `C: ${t.politik.C.name}`],
                  ]}
                />
                <p className="hilfe">{t.politik[form.politik].kurz}</p>
              </div>
              {form.politik !== 'A' && (
                <div className="feld">
                  <span id="polster-l">{E.polster}</span>
                  <Wahl
                    label="polster-l"
                    wert={String(form.politikFaktor) as '1' | '2'}
                    onChange={(v) => setze('politikFaktor', v === '2' ? 2 : 1)}
                    optionen={[['1', E.polsterOptionen['1']], ['2', E.polsterOptionen['2']]]}
                  />
                </div>
              )}
              <label className="schalter">
                <input type="checkbox" checked={form.botBetrieb} onChange={(ev) => setze('botBetrieb', ev.target.checked)} />
                <span>
                  {E.bot}
                  <small>{E.botHilfe}</small>
                </span>
              </label>
              <label className="schalter">
                <input type="checkbox" checked={form.perpKosten} onChange={(ev) => setze('perpKosten', ev.target.checked)} />
                <span>
                  {E.perp}
                  <small>{E.perpHilfe}</small>
                </span>
              </label>
              <div className="feld">
                <span id="pfade-l">{E.genauigkeit}</span>
                <Wahl
                  label="pfade-l"
                  wert={String(form.pfade) as '300' | '1000' | '3000'}
                  onChange={(v) => setze('pfade', Number(v))}
                  optionen={[['300', E.pfade['300']], ['1000', E.pfade['1000']], ['3000', E.pfade['3000']]]}
                />
                <span className="hilfe">{E.pfadeHilfe(zahlText(form.pfade))}</span>
              </div>
            </fieldset>
          </div>

          {sicherheit && (
            <dl className="kante" aria-live="polite">
              <div>
                <dt>{E.erwartung}</dt>
                <dd className={`num ${sicherheit.erwartung > 0 ? 'plus' : 'minus'}`}>{rText(sicherheit.erwartung)}</dd>
              </div>
              <div>
                <dt>{E.streuungJeTrade}</dt>
                <dd className="num">{rText(sicherheit.sd, false)}</dd>
              </div>
              <div className="kante-beleg">
                <dt>{E.belegTitel}</dt>
                {sicherheit.tradesNoetig ? (
                  <dd>
                    <b className="num">{E.beleg(zahlText(sicherheit.tradesNoetig))}</b> <span>{E.belegText}</span>
                  </dd>
                ) : (
                  <dd>
                    <b className="minus">{E.keineKanteWert}</b> <span>{E.keineKante}</span>
                  </dd>
                )}
              </div>
            </dl>
          )}
          {geprueft.fehler.length > 0 && (
            <p className="warnung" role="alert">{E.bittePruefen} {geprueft.fehler.join(' · ')}</p>
          )}
          <div className="aktion">
            <button className="btn btn-inv knopf" type="submit" disabled={!geprueft.einst}>
              {lauf.status === 'laeuft' ? E.neuStarten : E.berechnen}
            </button>
            {lauf.status === 'laeuft' && (
              <div className="fortschritt" role="status">
                <span>{E.fortschritt(zahlText(lauf.fertig), zahlText(lauf.gesamt))}</span>
                <div className="balken"><span style={{ width: `${lauf.gesamt ? (100 * lauf.fertig) / lauf.gesamt : 0}%` }} /></div>
              </div>
            )}
            {lauf.status !== 'laeuft' && veraltet && <span className="hinweis">{E.veraltet}</span>}
            {lauf.status === 'fertig' && !veraltet && ergebnis && (
              <span className="status">{E.fertig(zahlText(ergebnis.pfade), alleSchluessel.length, zahlText(ergebnis.dauerMs / 1000, 1))}</span>
            )}
            {lauf.status === 'fehler' && <span className="hinweis" role="alert">{E.fehlerPrefix} {lauf.fehler}</span>}
          </div>
        </form>
      </section>

      {ergebnis && <Ergebnisse ergebnis={ergebnis} eintraege={eintraege} daten={DATEN} veraltet={veraltet} sprache={sprache} />}
    </>
  )
}

function Feld({ label, einheit, wert, onChange, hilfe }: { label: string; einheit?: string; wert: string; onChange: (v: string) => void; hilfe?: string }) {
  return (
    <label className="feld">
      <span>{label}</span>
      <span className="eingabe">
        <input inputMode="decimal" value={wert} onChange={(ev) => onChange(ev.target.value)} />
        {einheit && <span className="einheit">{einheit}</span>}
      </span>
      {hilfe && <span className="hilfe">{hilfe}</span>}
    </label>
  )
}

/** Segmentierte Auswahl (eine Option aktiv). Eigene Klasse, damit die Landing-Regeln für .seg (Farbschema-Schalter) nicht greifen. */
function Wahl<T extends string>({ label, wert, onChange, optionen }: { label: string; wert: T; onChange: (v: T) => void; optionen: [T, string][] }) {
  return (
    <div className="wahl" role="group" aria-labelledby={label}>
      {optionen.map(([v, text]) => (
        <button key={v} type="button" aria-pressed={wert === v} onClick={() => onChange(v)}>{text}</button>
      ))}
    </div>
  )
}
