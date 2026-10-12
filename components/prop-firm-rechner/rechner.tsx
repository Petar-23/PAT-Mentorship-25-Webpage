'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import rohDaten from '@/lib/prop-firm/daten/regeln-2026-10-09.json'
import { ladeKonten, type RegelDaten } from '@/lib/prop-firm/konten'
import { baueZeilen, kantenSicherheit, schluesselFuer, verbinde } from '@/lib/prop-firm/auswertung'
import type { RohErgebnis, SimEinstellungen } from '@/lib/prop-firm/simulation'
import { PUNKTWERT } from '@/lib/prop-firm/stroeme'
import { Ergebnisse, unterzeile, type Ergebnis } from './ergebnisse'
import { Scheitern } from './scheitern'
import { Erklaerung, Zaehler } from './bewegung'
import { type Form } from './start'
import { woerterbuch, type Sprache, type Woerterbuch } from './texte'

const DATEN = rohDaten as unknown as RegelDaten
const SAAT = 20261009
/** Nach einer Eingabe so lange warten, bevor neu gerechnet wird (Tippen soll nicht jedes Mal starten). */
const WARTEN_MS = 600

/** Eingabe -> Zahl. Deutsch: Komma ist das Dezimalzeichen. Englisch: Punkt, Komma trennt Tausender. */
export function zahlAus(s: string, sprache: Sprache): number {
  const t = String(s).replace(/\s/g, '')
  if (sprache === 'en') return Number(t.replace(/,/g, ''))
  // Deutsch: Komma ist Dezimalzeichen, Punkte trennen Tausender (1.000 oder 1.000,5); „1.5“ bleibt 1,5
  if (t.includes(',') || /^\d{1,3}(\.\d{3})+$/.test(t)) return Number(t.replace(/\./g, '').replace(',', '.'))
  return Number(t)
}

export function pruefe(f: Form, t: Woerterbuch): { einst: SimEinstellungen | null; fehler: string[] } {
  const fehler: string[] = []
  const z = (s: string) => zahlAus(s, t.sprache)
  const p = z(f.trefferquote)
  const crv = z(f.crv)
  const tw = z(f.tradesProWoche)
  const risiko = z(f.risikoUsd)
  const stop = z(f.stopPunkte)
  const F = t.eingaben.fehler
  if (!(p >= 1 && p <= 99)) fehler.push(F.trefferquote)
  if (!(crv > 0 && crv <= 20)) fehler.push(F.crv)
  if (!(tw >= 0.2 && tw <= 60)) fehler.push(F.trades)
  if (!(stop >= 1 && stop <= 500)) fehler.push(F.stopp)
  if (!(risiko >= 1 && risiko <= 100000)) fehler.push(F.risiko)
  if (fehler.length) return { einst: null, fehler }
  return {
    fehler,
    einst: {
      strom: {
        trefferquote: p / 100, gewinnR: crv, verlustR: 1, tradesProWoche: tw, streuung: f.streuung, stopPunkte: stop,
        instrument: f.instrument, nqKurs: 20000, verlustStreuung: f.verlustStreuung,
      },
      groessenModus: 'risiko', risikoUsd: risiko, kontrakte: 1, ddAnteil: 0.1, politik: f.politik,
      politikFaktor: f.politikFaktor, botBetrieb: f.botBetrieb, perpKosten: f.perpKosten, saat: SAAT,
    },
  }
}

type Lauf = { status: 'leer' | 'laeuft' | 'fertig' | 'fehler'; fertig: number; gesamt: number; fehler?: string }

/**
 * Vorwärts-Ergebnis im geführten Ablauf: rechnet die Antworten (Trefferquote, CRV, Risiko, Trades pro Woche) in Workern
 * gegen alle Kontotypen, sofort beim Öffnen und nach jeder Änderung der Annahmen. Zusammenfassung, Gründe, Top 3, Tabelle.
 */
export function VorErgebnis({ sprache, form, setForm, onAendern }: {
  sprache: Sprache
  form: Form
  setForm: (f: (alt: Form) => Form) => void
  onAendern: () => void
}) {
  const t = woerterbuch(sprache)
  const E = t.eingaben
  const R = t.ergebnis
  const { usd, zahlText, r: rText } = t.f
  const eintraege = useMemo(() => ladeKonten(DATEN), [])
  const alleSchluessel = useMemo(() => eintraege.flatMap((e) => e.rechnungen.map((r) => schluesselFuer(e.id, r.name))), [eintraege])
  const [lauf, setLauf] = useState<Lauf>({ status: 'laeuft', fertig: 0, gesamt: form.pfade })
  const [ergebnis, setErgebnis] = useState<Ergebnis | null>(null)
  const workers = useRef<Worker[]>([])
  const laufId = useRef(0)
  const angefragt = useRef('')

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

  const starte = useCallback(
    (f: Form) => {
      const { einst } = pruefe(f, woerterbuch(sprache))
      if (!einst) return
      angefragt.current = JSON.stringify(f)
      beende()
      setLauf({ status: 'laeuft', fertig: 0, gesamt: f.pfade })
      rechne(einst, f.pfade, JSON.stringify(f))
    },
    [beende, rechne, sprache],
  )

  // Beim Verlassen Worker beenden
  useEffect(() => beende, [beende])

  // Sofort beim Öffnen rechnen, danach nach jeder gültigen Änderung kurz warten und neu rechnen
  useEffect(() => {
    if (!geprueft.einst || formSchl === angefragt.current) return
    const sofort = angefragt.current === ''
    const id = window.setTimeout(() => starte(JSON.parse(formSchl) as Form), sofort ? 0 : WARTEN_MS)
    return () => window.clearTimeout(id)
  }, [formSchl, geprueft.einst, starte])

  const sicherheit = geprueft.einst ? kantenSicherheit(geprueft.einst.strom) : null
  const kontrakteBeiRisiko = geprueft.einst
    ? Math.floor(geprueft.einst.risikoUsd / (geprueft.einst.strom.stopPunkte * PUNKTWERT[geprueft.einst.strom.instrument]))
    : 0

  // bester Kontotyp in der Rangfolge (alle Firmen und Größen)
  const bester = useMemo(() => {
    if (!ergebnis) return null
    const zeilen = baueZeilen(eintraege, ergebnis.roh, ergebnis.einst.botBetrieb).filter((z) => z.inRangfolge && z.rangNetto !== null)
    return zeilen.sort((a, b) => (b.rangNetto as number) - (a.rangNetto as number))[0] ?? null
  }, [ergebnis, eintraege])
  const antworten = `${form.trefferquote} % · ${E.crv} ${form.crv} · ${form.risikoUsd} USD · ${form.tradesProWoche} ${t.wz.proWoche}`

  return (
    <div className="vor">
      <section className="zusammenfassung" aria-live="polite" aria-labelledby="vor-ergebnis">
        <p className="ebene" id="vor-ergebnis">{t.wz.vorKicker}</p>
        {bester && bester.rangNetto !== null ? (
          <>
            <p className="zf-name">
              {bester.eintrag.firma} {t.f.groesseKurz(bester.eintrag.groesse)}
              <small>{unterzeile(bester.eintrag, t)}</small>
            </p>
            <p className="zf-zahl">
              <b className={`num ${bester.rangNetto > 0 ? '' : 'minus'}`}>
                <Zaehler wert={bester.rangNetto} format={(x) => usd(x, true)} />
              </b>
              <span>{R.proMonatKurz}</span>
            </p>
            <p className="zf-satz zf-klein">
              {bester.rangNetto > 0
                ? R.zusammenfassung(`${bester.eintrag.firma} ${t.f.groesseKurz(bester.eintrag.groesse)}`, usd(bester.rangNetto, true))
                : R.zusammenfassungMinus(`${bester.eintrag.firma} ${t.f.groesseKurz(bester.eintrag.groesse)}`, usd(bester.rangNetto, true))}
              {sicherheit ? ` ${R.erwartungSatz(rText(sicherheit.erwartung))}` : ''}
            </p>
            <Scheitern anteile={bester.kante} sprache={sprache} kompakt />
          </>
        ) : (
          <p className="zf-satz">{R.rechnet}</p>
        )}
        <div className="zf-status">
          {lauf.status === 'laeuft' && (
            <div className="fortschritt" role="status">
              <span>{E.fortschritt(zahlText(lauf.fertig), zahlText(lauf.gesamt))}</span>
              <div className="balken"><span style={{ width: `${lauf.gesamt ? (100 * lauf.fertig) / lauf.gesamt : 0}%` }} /></div>
            </div>
          )}
          {lauf.status === 'fertig' && !veraltet && ergebnis && (
            <span className="status">{E.fertig(zahlText(ergebnis.pfade), alleSchluessel.length, zahlText(ergebnis.dauerMs / 1000, 1))}</span>
          )}
          {lauf.status === 'fehler' && <span className="hinweis" role="alert">{E.fehlerPrefix} {lauf.fehler}</span>}
        </div>
        <div className="zf-antworten">
          <span>{antworten}</span>
          <button type="button" className="lnk-knopf" onClick={onAendern}>{t.wz.aendern}</button>
        </div>
        <Erklaerung titel={t.wz.annahmen}>
          <div className="mehr-grid">
            <div className="feld">
              <span id="streuung-l">{E.gewinner}</span>
              <Wahl
                label="streuung-l"
                wert={form.streuung}
                onChange={(v) => setze('streuung', v)}
                optionen={[['gleich', E.streuung.gleich], ['gemischt', E.streuung.gemischt], ['wenige_grosse', E.streuung.wenige_grosse]]}
              />
              <span className="hilfe">{E.streuungHilfe}</span>
            </div>
            <label className="schalter">
              <input type="checkbox" checked={form.verlustStreuung} onChange={(ev) => setze('verlustStreuung', ev.target.checked)} />
              <span>
                {E.verlustStreuung}
                <small>{E.verlustStreuungHilfe}</small>
              </span>
            </label>
            <div className="zwei">
              <div className="feld">
                <span id="instr-l">{E.instrument}</span>
                <Wahl label="instr-l" wert={form.instrument} onChange={(v) => setze('instrument', v)} optionen={[['MNQ', 'MNQ'], ['NQ', 'NQ']]} />
              </div>
              <Feld label={E.stopp} einheit={E.punkte} wert={form.stopPunkte} onChange={(v) => setze('stopPunkte', v)} />
            </div>
            <p className="hilfe">{E.stoppSatz}</p>
            {geprueft.einst && (
              <p className="hilfe">
                {E.futuresHinweis(
                  kontrakteBeiRisiko,
                  form.instrument,
                  usd(kontrakteBeiRisiko * geprueft.einst.strom.stopPunkte * PUNKTWERT[form.instrument]),
                  usd(geprueft.einst.risikoUsd),
                )}
              </p>
            )}
            {geprueft.einst && kontrakteBeiRisiko === 0 && <p className="warnung">{E.keinKontrakt}</p>}
            <div className="feld">
              <span id="politik-l">{E.weg}</span>
              <Wahl
                label="politik-l"
                wert={form.politik}
                onChange={(v) => setze('politik', v)}
                optionen={[['A', `A: ${t.politik.A.name}`], ['B', `B: ${t.politik.B.name}`], ['C', `C: ${t.politik.C.name}`]]}
              />
              <span className="hilfe">{t.politik[form.politik].kurz}</span>
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
                wert={String(form.pfade) as '500' | '1500' | '3000'}
                onChange={(v) => setze('pfade', Number(v))}
                optionen={[['500', E.pfade['500']], ['1500', E.pfade['1500']], ['3000', E.pfade['3000']]]}
              />
              <span className="hilfe">{E.pfadeHilfe(zahlText(form.pfade))}</span>
            </div>
          </div>
        </Erklaerung>
        {sicherheit && (
          <Erklaerung titel={t.modi.warum}>
            <p>
              {R.sicherText(rText(sicherheit.erwartung), rText(sicherheit.sd, false))}
              {sicherheit.tradesNoetig
                ? R.sicherBand(rText(sicherheit.erwartung - sicherheit.band100), rText(sicherheit.erwartung + sicherheit.band100), zahlText(sicherheit.tradesNoetig))
                : R.sicherOhne}
            </p>
            <p>{R.schaetzung}</p>
            {ergebnis && (
              <p>
                {R.unter(zahlText(ergebnis.pfade), t.politik[ergebnis.einst.politik].name, ergebnis.einst.politik !== 'A' ? ergebnis.einst.politikFaktor : null, ergebnis.einst.botBetrieb)}
              </p>
            )}
          </Erklaerung>
        )}
      </section>

      {ergebnis && <Ergebnisse ergebnis={ergebnis} eintraege={eintraege} daten={DATEN} veraltet={veraltet} sprache={sprache} />}
    </div>
  )
}

export function Feld({ label, einheit, wert, onChange, hilfe }: { label: string; einheit?: string; wert: string; onChange: (v: string) => void; hilfe?: string }) {
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
export function Wahl<T extends string>({ label, wert, onChange, optionen }: { label: string; wert: T; onChange: (v: T) => void; optionen: [T, string][] }) {
  return (
    <div className="wahl" role="group" aria-labelledby={label}>
      {optionen.map(([v, text]) => (
        <button key={v} type="button" aria-pressed={wert === v} onClick={() => onChange(v)}>{text}</button>
      ))}
    </div>
  )
}
