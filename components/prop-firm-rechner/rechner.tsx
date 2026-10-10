'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import rohDaten from '@/lib/prop-firm/daten/regeln-2026-10-09.json'
import { ladeKonten, type RegelDaten } from '@/lib/prop-firm/konten'
import { kantenSicherheit, schluesselFuer, verbinde } from '@/lib/prop-firm/auswertung'
import type { RohErgebnis, SimEinstellungen } from '@/lib/prop-firm/simulation'
import { PUNKTWERT, type Streuung } from '@/lib/prop-firm/stroeme'
import { Ergebnisse, type Ergebnis } from './ergebnisse'
import { POLITIK_TEXT, r as rText, usd, zahlText } from './texte'

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

const START: Form = {
  trefferquote: '45', gewinnR: '1,5', verlustR: '1', tradesProWoche: '5', streuung: 'gemischt', groessenModus: 'risiko',
  risikoUsd: '200', instrument: 'MNQ', stopPunkte: '20', kontrakte: '3', ddAnteil: '10', politik: 'A', politikFaktor: 1,
  botBetrieb: false, perpKosten: true, pfade: 1000,
}

const zahlAus = (s: string) => Number(String(s).replace(/\s/g, '').replace(',', '.'))

function pruefe(f: Form): { einst: SimEinstellungen | null; fehler: string[] } {
  const fehler: string[] = []
  const p = zahlAus(f.trefferquote)
  const w = zahlAus(f.gewinnR)
  const l = zahlAus(f.verlustR)
  const t = zahlAus(f.tradesProWoche)
  const risiko = zahlAus(f.risikoUsd)
  const stop = zahlAus(f.stopPunkte)
  const k = zahlAus(f.kontrakte)
  const dd = zahlAus(f.ddAnteil)
  if (!(p >= 1 && p <= 99)) fehler.push('Trefferquote zwischen 1 und 99 %')
  if (!(w > 0 && w <= 20)) fehler.push('Durchschnittsgewinn größer 0 und höchstens 20 R')
  if (!(l > 0 && l <= 5)) fehler.push('Durchschnittsverlust größer 0 und höchstens 5 R')
  if (!(t >= 0.2 && t <= 60)) fehler.push('Trades pro Woche zwischen 0,2 und 60')
  if (!(stop >= 1 && stop <= 500)) fehler.push('Stopp zwischen 1 und 500 Punkten')
  if (f.groessenModus === 'risiko' && !(risiko >= 1 && risiko <= 100000)) fehler.push('Risiko pro Trade zwischen 1 und 100.000 USD')
  if (f.groessenModus === 'kontrakte' && !(Number.isInteger(k) && k >= 1 && k <= 200)) fehler.push('Kontrakte als ganze Zahl von 1 bis 200')
  if (f.groessenModus === 'dd_anteil' && !(dd >= 1 && dd <= 100)) fehler.push('Anteil vom Drawdown zwischen 1 und 100 %')
  if (fehler.length) return { einst: null, fehler }
  return {
    fehler,
    einst: {
      strom: { trefferquote: p / 100, gewinnR: w, verlustR: l, tradesProWoche: t, streuung: f.streuung, stopPunkte: stop, instrument: f.instrument, nqKurs: 20000 },
      groessenModus: f.groessenModus, risikoUsd: risiko, kontrakte: k, ddAnteil: dd / 100, politik: f.politik,
      politikFaktor: f.politikFaktor, botBetrieb: f.botBetrieb, perpKosten: f.perpKosten, saat: SAAT,
    },
  }
}

type Lauf = { status: 'leer' | 'laeuft' | 'fertig' | 'fehler'; fertig: number; gesamt: number; fehler?: string }

export function PropFirmRechner() {
  const eintraege = useMemo(() => ladeKonten(DATEN), [])
  const alleSchluessel = useMemo(() => eintraege.flatMap((e) => e.rechnungen.map((r) => schluesselFuer(e.id, r.name))), [eintraege])
  const [form, setForm] = useState<Form>(START)
  const [lauf, setLauf] = useState<Lauf>({ status: 'laeuft', fertig: 0, gesamt: START.pfade })
  const [ergebnis, setErgebnis] = useState<Ergebnis | null>(null)
  const workers = useRef<Worker[]>([])
  const laufId = useRef(0)

  const geprueft = useMemo(() => pruefe(form), [form])
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
            if (teile.every((t) => t !== null)) {
              setErgebnis({ roh: verbinde(teile as Record<string, RohErgebnis>[]), einst, pfade, dauerMs: performance.now() - t0, formSchl: schl })
              setLauf({ status: 'fertig', fertig: pfade, gesamt: pfade })
            }
          } else if (m.typ === 'fehler') {
            setLauf({ status: 'fehler', fertig: 0, gesamt: pfade, fehler: m.text })
          }
        }
        w.onerror = () => setLauf({ status: 'fehler', fertig: 0, gesamt: pfade, fehler: 'Die Rechnung im Hintergrund ist abgebrochen.' })
        w.postMessage({ typ: 'auftrag', id, einst, schluessel: alleSchluessel, von, bis })
      })
    },
    [beende, alleSchluessel],
  )

  const starte = () => {
    const { einst } = pruefe(form)
    if (!einst) return
    if (lauf.status === 'laeuft') beende()
    setLauf({ status: 'laeuft', fertig: 0, gesamt: form.pfade })
    rechne(einst, form.pfade, formSchl)
  }

  // Erste Rechnung mit den Startwerten (Zustand steht schon auf „läuft“); beim Verlassen Worker beenden.
  // Im Strict Mode läuft das zweimal: Aufräumen beendet die Worker, der zweite Lauf startet frisch.
  useEffect(() => {
    const { einst } = pruefe(START)
    if (einst) rechne(einst, START.pfade, JSON.stringify(START))
    return beende
  }, [rechne, beende])

  const sicherheit = geprueft.einst ? kantenSicherheit(geprueft.einst.strom) : null

  const kontrakteBeiRisiko = geprueft.einst
    ? Math.floor(geprueft.einst.risikoUsd / (geprueft.einst.strom.stopPunkte * PUNKTWERT[geprueft.einst.strom.instrument]))
    : 0
  const risikoBeiKontrakten = geprueft.einst
    ? geprueft.einst.kontrakte * geprueft.einst.strom.stopPunkte * PUNKTWERT[geprueft.einst.strom.instrument]
    : 0

  return (
    <>
      <section className="wrap" aria-labelledby="eingaben-titel">
        <h2 id="eingaben-titel" className="sr-only">Deine Eingaben</h2>
        <form
          className="panel eingaben"
          onSubmit={(ev) => {
            ev.preventDefault()
            starte()
          }}
        >
          <div className="eingaben-grid">
            <fieldset>
              <legend>Deine Trades</legend>
              <Feld label="Trefferquote" einheit="%" wert={form.trefferquote} onChange={(v) => setze('trefferquote', v)} />
              <div className="zwei">
                <Feld label="Ø Gewinn" einheit="R" wert={form.gewinnR} onChange={(v) => setze('gewinnR', v)} />
                <Feld label="Ø Verlust" einheit="R" wert={form.verlustR} onChange={(v) => setze('verlustR', v)} />
              </div>
              <p className="klein" style={{ marginTop: -6, marginBottom: 14 }}>
                In R nach Gebühren und Slippage. 1 R = dein Risiko je Trade.
              </p>
              <Feld label="Trades pro Woche" wert={form.tradesProWoche} onChange={(v) => setze('tradesProWoche', v)} />
              <div className="feld">
                <span id="streuung-l">Gewinner</span>
                <Seg
                  label="streuung-l"
                  wert={form.streuung}
                  onChange={(v) => setze('streuung', v)}
                  optionen={[
                    ['gleich', 'gleich groß'],
                    ['gemischt', 'gemischt'],
                    ['wenige_grosse', 'wenige große'],
                  ]}
                />
                <span className="hilfe">Gleicher Durchschnitt, andere Verteilung: „wenige große“ heißt viele kleine Gewinner und ab und zu ein Ausreißer.</span>
              </div>
            </fieldset>

            <fieldset>
              <legend>Positionsgröße</legend>
              <div className="feld">
                <span id="modus-l">Größe festlegen über</span>
                <Seg
                  label="modus-l"
                  wert={form.groessenModus}
                  onChange={(v) => setze('groessenModus', v)}
                  optionen={[
                    ['risiko', 'Risiko in USD'],
                    ['kontrakte', 'Kontrakte'],
                    ['dd_anteil', 'Anteil Drawdown'],
                  ]}
                />
              </div>
              {form.groessenModus === 'risiko' && (
                <Feld label="Risiko pro Trade" einheit="USD" wert={form.risikoUsd} onChange={(v) => setze('risikoUsd', v)} />
              )}
              {form.groessenModus === 'kontrakte' && (
                <Feld label="Kontrakte je Trade" wert={form.kontrakte} onChange={(v) => setze('kontrakte', v)} />
              )}
              {form.groessenModus === 'dd_anteil' && (
                <Feld
                  label="Risiko je Trade als Anteil vom Drawdown"
                  einheit="%"
                  wert={form.ddAnteil}
                  onChange={(v) => setze('ddAnteil', v)}
                  hilfe="Passt die Größe automatisch an jede Kontogröße an. 10 % heißt: zehn Verlierer in Folge leeren den Drawdown."
                />
              )}
              <div className="zwei">
                <div className="feld">
                  <span id="instr-l">Instrument</span>
                  <Seg label="instr-l" wert={form.instrument} onChange={(v) => setze('instrument', v)} optionen={[['MNQ', 'MNQ'], ['NQ', 'NQ']]} />
                </div>
                <Feld label="Stopp" einheit="Punkte" wert={form.stopPunkte} onChange={(v) => setze('stopPunkte', v)} />
              </div>
              {geprueft.einst && form.groessenModus === 'risiko' && (
                <p className="klein">
                  Futures: {kontrakteBeiRisiko} {form.instrument} je Trade ({usd(kontrakteBeiRisiko * geprueft.einst.strom.stopPunkte * PUNKTWERT[form.instrument])} echtes Risiko, ganze Kontrakte, gedeckelt durch die Firmengrenzen). Perps: {usd(geprueft.einst.risikoUsd)}.
                </p>
              )}
              {geprueft.einst && form.groessenModus === 'kontrakte' && (
                <p className="klein">= {usd(risikoBeiKontrakten)} Risiko je Trade (Perps rechnen mit demselben Betrag).</p>
              )}
              {geprueft.einst && form.groessenModus === 'risiko' && kontrakteBeiRisiko === 0 && (
                <p className="warnung">Mit diesem Risiko und Stopp ist nicht einmal ein Kontrakt möglich. Futures-Konten handeln dann gar nicht.</p>
              )}
            </fieldset>

            <fieldset>
              <legend>Auszahlungsweg und Rahmen</legend>
              <div className="feld">
                <span id="politik-l">Auszahlungsweg</span>
                <Seg
                  label="politik-l"
                  wert={form.politik}
                  onChange={(v) => setze('politik', v)}
                  optionen={[
                    ['A', `A: ${POLITIK_TEXT.A.name}`],
                    ['B', `B: ${POLITIK_TEXT.B.name}`],
                    ['C', `C: ${POLITIK_TEXT.C.name}`],
                  ]}
                />
                <p className="politik-text">{POLITIK_TEXT[form.politik].kurz}</p>
              </div>
              {form.politik !== 'A' && (
                <div className="feld">
                  <span id="polster-l">Polster</span>
                  <Seg
                    label="polster-l"
                    wert={String(form.politikFaktor) as '1' | '2'}
                    onChange={(v) => setze('politikFaktor', v === '2' ? 2 : 1)}
                    optionen={[['1', '1x Drawdown'], ['2', '2x Drawdown']]}
                  />
                </div>
              )}
              <label className="schalter">
                <input type="checkbox" checked={form.botBetrieb} onChange={(ev) => setze('botBetrieb', ev.target.checked)} />
                <span>
                  Ich handle mit einem Bot (API)
                  <small>Rechnet API-Gebühren ein und blendet Firmen aus, die Bots verbieten.</small>
                </span>
              </label>
              <label className="schalter">
                <input type="checkbox" checked={form.perpKosten} onChange={(ev) => setze('perpKosten', ev.target.checked)} />
                <span>
                  Zusatzkosten bei Perps einrechnen
                  <small>Spread 0,5 Punkte, Finanzierung 10 % im Jahr, Kommission der Firma (Vest, MyFundedPerps).</small>
                </span>
              </label>
              <div className="feld">
                <span id="pfade-l">Genauigkeit</span>
                <Seg
                  label="pfade-l"
                  wert={String(form.pfade) as '300' | '1000' | '3000'}
                  onChange={(v) => setze('pfade', Number(v))}
                  optionen={[['300', 'schnell'], ['1000', 'genau'], ['3000', 'sehr genau']]}
                />
                <span className="hilfe">{form.pfade.toLocaleString('de-DE')} simulierte Jahre je Kontotyp, jeweils mit und ohne Kante.</span>
              </div>
            </fieldset>
          </div>

          {sicherheit && (
            <div className="kante" aria-live="polite">
              <span>Erwartung je Trade <b className={sicherheit.erwartung > 0 ? 'plus' : 'minus'}>{rText(sicherheit.erwartung)}</b></span>
              <span>Streuung je Trade <b>{rText(sicherheit.sd, false)}</b></span>
              <span>
                {sicherheit.tradesNoetig
                  ? <>Um diese Kante sicher von null zu unterscheiden, brauchst du rund <b>{zahlText(sicherheit.tradesNoetig)} Trades</b> Beleg.</>
                  : <>Ohne positive Erwartung gibt es keine Kante. Jeder Gewinn wäre Glück.</>}
              </span>
            </div>
          )}
          {geprueft.fehler.length > 0 && (
            <p className="warnung" role="alert">Bitte prüfen: {geprueft.fehler.join(' · ')}</p>
          )}
          <div className="aktion">
            <button className="knopf" type="submit" disabled={!geprueft.einst}>
              {lauf.status === 'laeuft' ? 'Neu starten' : 'Berechnen'}
            </button>
            {lauf.status === 'laeuft' && (
              <div className="fortschritt" role="status">
                <span>Rechne {zahlText(lauf.fertig)} von {zahlText(lauf.gesamt)} simulierten Jahren …</span>
                <div className="balken"><span style={{ width: `${lauf.gesamt ? (100 * lauf.fertig) / lauf.gesamt : 0}%` }} /></div>
              </div>
            )}
            {lauf.status !== 'laeuft' && veraltet && <span className="hinweis">Eingaben geändert. Für neue Zahlen bitte neu berechnen.</span>}
            {lauf.status === 'fertig' && !veraltet && ergebnis && (
              <span className="klein">
                Fertig: {zahlText(ergebnis.pfade)} Jahre × {alleSchluessel.length} Regelvarianten in {zahlText(ergebnis.dauerMs / 1000, 1)} s, direkt in deinem Browser.
              </span>
            )}
            {lauf.status === 'fehler' && <span className="hinweis" role="alert">Fehler: {lauf.fehler}</span>}
          </div>
        </form>
      </section>

      {ergebnis && (
        <Ergebnisse ergebnis={ergebnis} eintraege={eintraege} daten={DATEN} veraltet={veraltet} />
      )}
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

function Seg<T extends string>({ label, wert, onChange, optionen }: { label: string; wert: T; onChange: (v: T) => void; optionen: [T, string][] }) {
  return (
    <div className="seg" role="group" aria-labelledby={label}>
      {optionen.map(([v, t]) => (
        <button key={v} type="button" aria-pressed={wert === v} onClick={() => onChange(v)}>{t}</button>
      ))}
    </div>
  )
}
