'use client'

import { AnimatePresence, MotionConfig, motion, useReducedMotion } from 'motion/react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ladeTabelle } from '@/lib/prop-firm/daten/rueckwaerts'
import { RW, type RwTabelle } from '@/lib/prop-firm/rueckwaerts'
import { DAUER, EASE, Erklaerung, Herein } from './bewegung'
import { CrvSkizze } from './crv-skizze'
import { CtaKarte } from './cta-karte'
import { Feld, VorErgebnis, pruefe, zahlAus } from './rechner'
import { RueckErgebnis, type RueckAntworten } from './rueckwaerts'
import { RUECK_START, STARTS, type Form } from './start'
import { woerterbuch, type Sprache } from './texte'

type Pfad = 'rueck' | 'vor'
const RUECK_FRAGEN = ['ziel', 'zeit', 'tpw', 'crv', 'sicher'] as const
const VOR_FRAGEN = ['treffer', 'crv', 'risiko', 'tpw'] as const
const CRV_WAHL = [1, 1.5, 2, 3]
/** Mindestdauer der Rechen-Animation; die Tabelle ist meist schneller geladen */
const RECHNEN_MS = 1300
/** Nach einem Tipp auf eine Antwort kurz stehen lassen, dann weiter */
const AUTO_WEITER_MS = 260

const ANZAHL_RUECK = 126

/**
 * Geführter Ablauf: eine Frage je Bildschirm mit Fortschritt, Zurück und Weiter.
 * Standard ist rückwärts (Ziel, Zeitraum, Trades pro Woche, CRV, Sicherheit → Rechen-Animation → Ergebnis);
 * „Ich kenne meine Zahlen“ zweigt vorwärts ab (Trefferquote, CRV, Risiko, Trades pro Woche → Ergebnis).
 * Am Ende steht immer die CTA-Karte. Bewegung über motion; bei „Bewegung reduzieren“ nur kurze Überblendungen.
 */
export function Wizard({ sprache }: { sprache: Sprache }) {
  const t = woerterbuch(sprache)
  const W = t.wz
  const F = W.fragen
  const ruhig = useReducedMotion()
  const [pfad, setPfad] = useState<Pfad>('rueck')
  const [index, setIndex] = useState(0)
  const [richtung, setRichtung] = useState(1)
  const [antworten, setAntworten] = useState<RueckAntworten>({ ziel: RUECK_START.ziel, monate: RUECK_START.monate, tpw: RUECK_START.tradesProWoche, sicherheit: RUECK_START.sicherheit, crv: 2 })
  const [form, setForm] = useState<Form>(STARTS[sprache])
  const [tabelle, setTabelle] = useState<{ schl: string; t: RwTabelle } | null>(null)
  const [rechnenFertig, setRechnenFertig] = useState(false)
  const wurzel = useRef<HTMLElement>(null)
  const frage = useRef<HTMLHeadingElement>(null)

  const fragen = pfad === 'rueck' ? RUECK_FRAGEN : VOR_FRAGEN
  const n = fragen.length
  const phase: 'frage' | 'rechnen' | 'ergebnis' =
    index < n ? 'frage' : pfad === 'rueck' && index === n && !rechnenFertig ? 'rechnen' : 'ergebnis'
  const schluessel = `${pfad}-${index}-${phase}`
  const tabSchl = `${antworten.tpw}-${antworten.monate}`
  const tabelleBereit = tabelle?.schl === tabSchl ? tabelle.t : null

  // Tabelle laden, sobald Trades pro Woche und Zeitraum feststehen (meist schon während der letzten Fragen)
  useEffect(() => {
    if (pfad !== 'rueck' || index < 3) return
    let aktiv = true
    ladeTabelle(antworten.tpw, antworten.monate).then((tab) => {
      if (aktiv) setTabelle({ schl: `${antworten.tpw}-${antworten.monate}`, t: tab })
    })
    return () => {
      aktiv = false
    }
  }, [pfad, index, antworten.tpw, antworten.monate])

  // Rechen-Animation: mindestens RECHNEN_MS, und erst weiter, wenn die Tabelle da ist
  useEffect(() => {
    if (phase !== 'rechnen' || !tabelleBereit) return
    const id = window.setTimeout(() => setRechnenFertig(true), ruhig ? 300 : RECHNEN_MS)
    return () => window.clearTimeout(id)
  }, [phase, tabelleBereit, ruhig])

  // Nach jedem Schrittwechsel: Anfang des Ablaufs ins Bild, Fokus auf die Frage (für Tastatur und Screenreader)
  const ersterRender = useRef(true)
  useEffect(() => {
    if (ersterRender.current) {
      ersterRender.current = false
      return
    }
    const el = wurzel.current
    if (el && el.getBoundingClientRect().top < 0) el.scrollIntoView({ block: 'start', behavior: ruhig ? 'auto' : 'smooth' })
    const id = window.setTimeout(() => frage.current?.focus({ preventScroll: true }), DAUER * 1000 + 40)
    return () => window.clearTimeout(id)
  }, [schluessel, ruhig])

  const geh = (neu: number, dir: number) => {
    setRichtung(dir)
    if (neu <= n - 1) setRechnenFertig(false)
    setIndex(neu)
  }
  const weiter = () => geh(index + 1, 1)
  const zurueck = () => {
    if (index === 0 && pfad === 'vor') return wechsle('rueck')
    geh(Math.max(0, index - 1), -1)
  }
  const wechsle = (p: Pfad) => {
    setRichtung(p === 'vor' ? 1 : -1)
    setPfad(p)
    setRechnenFertig(false)
    setIndex(0)
  }
  const neuStart = () => {
    setRichtung(-1)
    setPfad('rueck')
    setRechnenFertig(false)
    setIndex(0)
  }
  // Antwort tippen: Wert setzen, kurz zeigen, dann weiter (ein zweiter Tipp in der Zeit zählt nicht doppelt)
  const wartet = useRef(false)
  const waehle = <K extends keyof RueckAntworten>(k: K, v: RueckAntworten[K]) => {
    setAntworten((a) => ({ ...a, [k]: v }))
    if (wartet.current) return
    wartet.current = true
    window.setTimeout(() => {
      wartet.current = false
      weiter()
    }, ruhig ? 0 : AUTO_WEITER_MS)
  }

  // Vorwärts: Gültigkeit je Frage
  const fehlerVor = pruefe(form, t).fehler
  const zahlOk = (s: string, min: number, max: number) => {
    const x = zahlAus(s, sprache)
    return Number.isFinite(x) && x >= min && x <= max
  }
  const vorOk: Record<(typeof VOR_FRAGEN)[number], boolean> = {
    treffer: zahlOk(form.trefferquote, 1, 99),
    crv: zahlOk(form.crv, 0.01, 20),
    risiko: zahlOk(form.risikoUsd, 1, 100000),
    tpw: zahlOk(form.tradesProWoche, 0.2, 60),
  }
  const setzeForm = (k: keyof Form, v: string) => setForm((f) => ({ ...f, [k]: v }))

  const varianten = {
    rein: (d: number) => (ruhig ? { opacity: 0 } : { opacity: 0, x: d * 32 }),
    da: { opacity: 1, x: 0 },
    raus: (d: number) => (ruhig ? { opacity: 0 } : { opacity: 0, x: d * -32 }),
  }
  const fortschritt = phase === 'ergebnis' ? 1 : phase === 'rechnen' ? (n + 0.5) / (n + 1) : (index + 1) / (n + 1)

  const crvText = (c: number) => t.f.zahlText(c, 1)
  let inhalt: ReactNode = null
  if (phase === 'frage') {
    const art = fragen[index]
    // Frage, Unterzeile und „Was heißt das?“ direkt darunter (auf dem Handy ohne Scrollen erreichbar)
    const kopf = (f: { frage: string; unter: string; erklaerung: string }) => (
      <>
        <p className="wz-nr">{W.schritt(index + 1, n)}</p>
        <h2 className="wz-frage" ref={frage} tabIndex={-1}>{f.frage}</h2>
        <p className="wz-unter">{f.unter}</p>
        <Erklaerung titel={W.wasHeisst} klasse="erkl-frage">{f.erklaerung}</Erklaerung>
      </>
    )
    if (pfad === 'rueck') {
      if (art === 'ziel') {
        inhalt = (
          <>
            {kopf(F.ziel)}
            <Optionen>
              {RW.ziele.map((z, i) => (
                <Chip key={z} i={i} an={antworten.ziel === z} onClick={() => waehle('ziel', z)}>
                  {t.f.usd(z)}
                </Chip>
              ))}
            </Optionen>
          </>
        )
      } else if (art === 'zeit') {
        inhalt = (
          <>
            {kopf(F.zeit)}
            <Optionen>
              {RW.monate.map((m, i) => (
                <Chip key={m} i={i} an={antworten.monate === m} onClick={() => waehle('monate', m)}>
                  {t.rueck.monateChip(m)}
                </Chip>
              ))}
            </Optionen>
          </>
        )
      } else if (art === 'tpw') {
        inhalt = (
          <>
            {kopf(F.tpw)}
            <Optionen>
              {RW.tradesProWoche.map((x, i) => (
                <Chip key={x} i={i} an={antworten.tpw === x} onClick={() => waehle('tpw', x)} unter={W.proWoche}>
                  {x}
                </Chip>
              ))}
            </Optionen>
          </>
        )
      } else if (art === 'crv') {
        inhalt = (
          <>
            {kopf(F.crv)}
            <div className="wz-crv">
              <Optionen>
                {CRV_WAHL.map((c, i) => (
                  <Chip key={c} i={i} an={antworten.crv === c} onClick={() => setAntworten((a) => ({ ...a, crv: c }))}>
                    {`1 : ${crvText(c)}`}
                  </Chip>
                ))}
              </Optionen>
              <CrvSkizze crv={antworten.crv} sprache={sprache} />
            </div>
          </>
        )
      } else {
        inhalt = (
          <>
            {kopf(F.sicher)}
            <Optionen>
              {RW.sicherheit.map((s, i) => (
                <Chip key={s} i={i} an={antworten.sicherheit === s} onClick={() => waehle('sicherheit', s)} unter={W.sicherHinweis[String(s)]}>
                  {t.rueck.sicherheitOption(s)}
                </Chip>
              ))}
            </Optionen>
          </>
        )
      }
    } else {
      const feldMitChips = (k: keyof Form, einheit: string, chips: number[], fmt: (x: number) => string) => (
        <div className="wz-eingabe">
          <Optionen>
            {chips.map((c, i) => (
              <Chip key={c} i={i} an={zahlAus(String(form[k]), sprache) === c} onClick={() => setzeForm(k, t.f.zahlText(c, 1))}>
                {fmt(c)}
              </Chip>
            ))}
          </Optionen>
          <Feld label={W.crvAnders} einheit={einheit} wert={String(form[k])} onChange={(v) => setzeForm(k, v)} />
        </div>
      )
      if (art === 'treffer') {
        inhalt = (
          <>
            {kopf(F.treffer)}
            {feldMitChips('trefferquote', '%', [35, 40, 45, 50, 55, 60], (x) => t.f.prozent(x))}
          </>
        )
      } else if (art === 'crv') {
        const c = zahlAus(form.crv, sprache)
        inhalt = (
          <>
            {kopf(F.crv)}
            <div className="wz-crv">
              {feldMitChips('crv', ': 1', CRV_WAHL, (x) => `1 : ${crvText(x)}`)}
              <CrvSkizze crv={Number.isFinite(c) && c > 0 ? c : 2} sprache={sprache} />
            </div>
          </>
        )
      } else if (art === 'risiko') {
        inhalt = (
          <>
            {kopf(F.risiko)}
            {feldMitChips('risikoUsd', 'USD', [100, 200, 300, 500], (x) => t.f.usd(x))}
          </>
        )
      } else {
        inhalt = (
          <>
            {kopf(F.tpw)}
            {feldMitChips('tradesProWoche', W.proWoche, [2, 5, 10, 20], (x) => String(x))}
          </>
        )
      }
    }
  } else if (phase === 'rechnen') {
    inhalt = (
      <div className="wz-rechnen" role="status">
        <h2 className="wz-frage" ref={frage} tabIndex={-1}>{W.rechnet(tabelleBereit?.konten.length ?? ANZAHL_RUECK)}</h2>
        <div className="wz-rechnen-balken">
          <motion.i initial={{ width: '0%' }} animate={{ width: '100%' }} transition={{ duration: ruhig ? 0 : RECHNEN_MS / 1000, ease: [0.4, 0, 0.2, 1] }} />
        </div>
        <ul>
          {W.rechnetZeilen.map((z, i) => (
            <motion.li
              key={z}
              initial={ruhig ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: ruhig ? 0 : 0.15 + i * 0.32, duration: 0.25, ease: EASE }}
            >
              {z}
            </motion.li>
          ))}
        </ul>
      </div>
    )
  } else if (pfad === 'rueck' && tabelleBereit) {
    inhalt = (
      <div className="wz-ergebnis">
        <h2 className="sr-only" ref={frage} tabIndex={-1}>{W.ergebnisKicker}</h2>
        <RueckErgebnis sprache={sprache} tabelle={tabelleBereit} antworten={antworten} onAendern={() => geh(0, -1)} />
        <CtaKarte sprache={sprache} />
        <p className="wz-neu">
          <button type="button" className="lnk-knopf" onClick={neuStart}>{W.neu}</button>
        </p>
      </div>
    )
  } else if (pfad === 'vor') {
    inhalt = (
      <div className="wz-ergebnis">
        <h2 className="sr-only" ref={frage} tabIndex={-1}>{W.vorKicker}</h2>
        <VorErgebnis sprache={sprache} form={form} setForm={setForm} onAendern={() => geh(0, -1)} />
        <CtaKarte sprache={sprache} />
        <p className="wz-neu">
          <button type="button" className="lnk-knopf" onClick={neuStart}>{W.neu}</button>
        </p>
      </div>
    )
  }

  const istFrage = phase === 'frage'
  const art = istFrage ? fragen[index] : null
  const weiterOk = pfad === 'rueck' || (art !== null && vorOk[art as (typeof VOR_FRAGEN)[number]])
  const letzte = index === n - 1

  return (
    <MotionConfig reducedMotion="user">
      <section ref={wurzel} className={`wrap wz${phase === 'ergebnis' ? ' wz-am-ende' : ''}`} id="rechner" aria-label={W.aria}>
        <div className="wz-leiste" aria-hidden="true">
          <motion.i animate={{ width: `${fortschritt * 100}%` }} transition={{ duration: 0.35, ease: EASE }} />
        </div>
        <div className="wz-buehne">
          <AnimatePresence mode="wait" custom={richtung} initial={false}>
            <motion.div
              key={schluessel}
              className="wz-schritt"
              custom={richtung}
              variants={varianten}
              initial="rein"
              animate="da"
              exit="raus"
              transition={{ duration: DAUER, ease: EASE }}
            >
              {inhalt}
            </motion.div>
          </AnimatePresence>
        </div>
        {istFrage && (
          <div className="wz-nav">
            {index > 0 || pfad === 'vor' ? (
              <button type="button" className="knopf-leise" onClick={zurueck}>
                <span aria-hidden="true">←</span> {W.zurueck}
              </button>
            ) : (
              <span />
            )}
            <button type="button" className="btn btn-inv wz-weiter" onClick={weiter} disabled={!weiterOk}>
              {letzte ? W.ergebnisZeigen : W.weiter} <span className="arr" aria-hidden="true">→</span>
            </button>
          </div>
        )}
        {istFrage && index === 0 && (
          <p className="wz-abzweig">
            {pfad === 'rueck' ? (
              <button type="button" className="lnk-knopf" onClick={() => wechsle('vor')}>
                {W.kenneZahlen} <span aria-hidden="true">→</span>
                <small>{W.kenneZahlenKurz}</small>
              </button>
            ) : (
              <button type="button" className="lnk-knopf" onClick={() => wechsle('rueck')}>
                <span aria-hidden="true">←</span> {W.vomZiel}
              </button>
            )}
          </p>
        )}
        {istFrage && pfad === 'vor' && fehlerVor.length > 0 && !weiterOk && (
          <p className="warnung" role="alert">{t.eingaben.bittePruefen} {fehlerVor.join(' · ')}</p>
        )}
      </section>
    </MotionConfig>
  )
}

function Optionen({ children }: { children: ReactNode }) {
  return <div className="wz-optionen">{children}</div>
}

function Chip({ an, onClick, children, unter, i }: { an: boolean; onClick: () => void; children: ReactNode; unter?: string; i: number }) {
  return (
    <Herein i={i} als="div" klasse="wz-chip-rahmen">
      <button type="button" className="wz-chip" aria-pressed={an} onClick={onClick}>
        <b>{children}</b>
        {unter && <small>{unter}</small>}
      </button>
    </Herein>
  )
}
