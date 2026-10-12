'use client'

import { AnimatePresence, MotionConfig, motion, useReducedMotion, type PanInfo } from 'motion/react'
import Image from 'next/image'
import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ThemeSwitch } from '@/components/landing-v3/client/theme-switch'
import { SiteFooter } from '@/components/landing-v3/sections/site-footer'
import rohDaten from '@/lib/prop-firm/daten/regeln-2026-10-09.json'
import { ladeTabelle } from '@/lib/prop-firm/daten/rueckwaerts'
import { ladeKonten, type RegelDaten } from '@/lib/prop-firm/konten'
import { openCookieSettings } from '@/lib/cookie-consent-client'
import { RW, detailRueckwaerts, type RwDetail, type RwTabelle } from '@/lib/prop-firm/rueckwaerts'
import { Blatt } from './blatt'
import { DAUER, EASE, Erklaerung, Herein } from './bewegung'
import { CrvSkizze } from './crv-skizze'
import { CtaKarte } from './cta-karte'
import { Hintergrund } from './hintergrund'
import { messe } from './messung'
import { DARUNTER_PUNKTE, RueckKlartext, VorKlartext } from './klartext'
import { Feld, VorAnnahmen, VorKonten, useVorRechnung, zahlAus } from './rechner'
import { KontenListe, loeseAntworten, type RueckAntworten, type Zeile } from './rueckwaerts'
import { Sprachwahl } from './sprachwahl'
import { START_STAND, schreibeVerlauf, verlaufAus, zielImVerlauf, type BlattArt, type Pfad, type Stand } from './verlauf'
import { RUECK_START, STARTS, type Form } from './start'
import { woerterbuch, type Sprache } from './texte'

const DATEN = rohDaten as unknown as RegelDaten
type Phase = 'frage' | 'rechnen' | 'fertig' | 'ergebnis'
const RUECK_FRAGEN = ['ziel', 'zeit', 'tpw', 'crv', 'sicher', 'groesse'] as const
const VOR_FRAGEN = ['treffer', 'crv', 'risiko', 'tpw'] as const
const CRV_WAHL = [1, 1.5, 2, 3]
const GROESSEN: { schl: string; max: number | null }[] = [
  { schl: 'alle', max: null },
  { schl: 'k50', max: 50000 },
  { schl: 'k100', max: 100000 },
  { schl: 'k150', max: 150000 },
]
/** Mindestdauer der Rechen-Animation */
const RECHNEN_MS = 1300
/** Nach einem Tipp auf eine Antwort kurz stehen lassen, dann weiter */
const AUTO_WEITER_MS = 260
/** Wischweg bzw. -tempo, ab dem ein Schritt wechselt */
const WISCH_PX = 70
const WISCH_TEMPO = 500

type RueckErgebnis = { schl: string; liste: Zeile[]; detail: RwDetail | null; darunter: RwDetail | null; fertigUm: number }

/**
 * Der Prop-Firm-Rechner als Bildschirm-App: genau ein Bildschirm hoch (100dvh), kein Seiten-Scroll.
 * Oben klein Titel, Sprache und Farbschema; in der Mitte eine Frage je Schritt (wischbar); unten Punkte, Zurück/Weiter und
 * eine Zeile mit „So rechnet der Rechner“, Impressum, Datenschutz, „Keine Finanzberatung“. Methode, Quellen, andere Konten
 * und Annahmen öffnen als Vollbild-Blatt. Am Ende: Rechen-Animation, Fertig-Schirm mit der CTA-Karte, Ergebnis in Klartext.
 */
export function Wizard({ sprache }: { sprache: Sprache }) {
  const t = woerterbuch(sprache)
  const W = t.wz
  const A = t.app
  const F = W.fragen
  const ruhig = useReducedMotion()
  const [pfad, setPfad] = useState<Pfad>('rueck')
  const [index, setIndex] = useState(0)
  const [richtung, setRichtung] = useState(1)
  const [antworten, setAntworten] = useState<RueckAntworten>({
    ziel: RUECK_START.ziel, monate: RUECK_START.monate, tpw: RUECK_START.tradesProWoche, sicherheit: RUECK_START.sicherheit, crv: 2, groesseMax: null,
  })
  const [form, setForm] = useState<Form>(STARTS[sprache])
  const [tabelle, setTabelle] = useState<{ schl: string; t: RwTabelle } | null>(null)
  const [rueck, setRueck] = useState<RueckErgebnis | null>(null)
  const [blatt, setBlatt] = useState<BlattArt | null>(null)
  const frage = useRef<HTMLHeadingElement>(null)
  const buehne = useRef<HTMLDivElement>(null)

  const fragen = pfad === 'rueck' ? RUECK_FRAGEN : VOR_FRAGEN
  const n = fragen.length
  const antwortSchl = JSON.stringify(antworten)
  const tabelleBereit = tabelle?.schl === `${antworten.tpw}-${antworten.monate}` ? tabelle.t : null
  const rueckBereit = rueck?.schl === antwortSchl ? rueck : null
  // Fertig-Schirm oder Ergebnis ohne passende Rechnung (etwa per Browser-Vor nach geänderter Antwort): erst rechnen
  const phase: Phase =
    index < n ? 'frage' : index === n || (pfad === 'rueck' && !rueckBereit) ? 'rechnen' : index === n + 1 ? 'fertig' : 'ergebnis'
  const schluessel = `${pfad}-${index}-${phase}`
  const eintraege = useMemo(() => new Map(ladeKonten(DATEN).map((e) => [e.id, e])), [])
  const rechnung = useVorRechnung(form, sprache, pfad === 'vor' && index >= n)

  // ---------------------------------------------------------------------------------------------- Schritte und Verlauf
  // Jeder gezeigte Schritt ist ein Eintrag im Browser-Verlauf (verlauf.ts): vorwärts = neuer Eintrag, zurück = history.back.
  const stapel = useRef<(Stand | undefined)[]>([START_STAND])
  const tiefe = useRef(0)
  const zeige = useCallback((s: Stand, dir: number) => {
    setRichtung(dir)
    setPfad(s.pfad)
    setIndex(s.index)
    setBlatt(s.blatt)
  }, [])
  /** Vorwärts zu s; ersetzen: ohne neuen Eintrag (Rechen-Animation → Fertig-Schirm). */
  const vor = useCallback((s: Stand, dir = 1, ersetzen = false) => {
    if (!ersetzen) {
      tiefe.current += 1
      stapel.current = stapel.current.slice(0, tiefe.current)
    }
    stapel.current[tiefe.current] = s
    schreibeVerlauf(ersetzen ? 'replace' : 'push', { tiefe: tiefe.current, stand: s })
    zeige(s, dir)
  }, [zeige])
  /** Zurück zu s: liegt s in der Kette davor, geht der Browser dorthin (popstate zeigt es), sonst wird ersetzt. */
  const zurueckZu = useCallback((s: Stand) => {
    const d = zielImVerlauf(stapel.current, tiefe.current, s)
    if (d >= 0) {
      window.history.go(d - tiefe.current)
      return
    }
    stapel.current[tiefe.current] = s
    schreibeVerlauf('replace', { tiefe: tiefe.current, stand: s })
    zeige(s, -1)
  }, [zeige])
  useEffect(() => {
    const pfadName = window.location.pathname
    schreibeVerlauf('replace', { tiefe: 0, stand: START_STAND })
    const beiPop = (ev: PopStateEvent) => {
      // Eintrag ohne Rechner-Daten auf derselben Seite: der Anfang (etwa wenn Next.js den ersten Eintrag neu geschrieben hat)
      const e = verlaufAus(ev.state) ?? (window.location.pathname === pfadName ? { tiefe: 0, stand: START_STAND } : null)
      if (!e) return
      const dir = e.tiefe < tiefe.current ? -1 : 1
      tiefe.current = e.tiefe
      stapel.current[e.tiefe] = e.stand
      zeige(e.stand, dir)
    }
    window.addEventListener('popstate', beiPop)
    return () => window.removeEventListener('popstate', beiPop)
  }, [zeige])

  // Messen (nur mit Einwilligung, siehe messung.ts): Start einmal je Seitenaufruf, Ergebnis einmal je Rechnung
  const gestartet = useRef(false)
  const gemeldet = useRef('')
  const starte = () => {
    if (gestartet.current) return
    gestartet.current = true
    messe(sprache, { name: 'rechner_start' })
  }
  const weiter = () => {
    starte()
    vor({ pfad, index: index + 1, blatt: null })
  }
  const wechsle = (p: Pfad) => {
    starte()
    vor({ pfad: p, index: 0, blatt: null }, p === 'vor' ? 1 : -1)
  }
  const zumErgebnis = () => {
    const schl = `${pfad}:${pfad === 'rueck' ? antwortSchl : JSON.stringify(form)}`
    if (gemeldet.current !== schl) {
      gemeldet.current = schl
      messe(sprache, { name: 'rechner_ergebnis', modus: pfad === 'rueck' ? 'rueckwaerts' : 'vorwaerts' })
    }
    vor({ pfad, index: n + 2, blatt: null })
  }
  const zurueck = () => {
    if (index === 0) {
      if (pfad === 'vor') zurueckZu({ pfad: 'rueck', index: 0, blatt: null })
      return
    }
    // aus dem Fertig-Schirm zurück zur letzten Frage (die Rechnung wird nicht noch einmal gezeigt)
    zurueckZu({ pfad, index: phase === 'fertig' ? n - 1 : index - 1, blatt: null })
  }
  const oeffne = (b: BlattArt) => vor({ pfad, index, blatt: b }, richtung)
  const schliesse = () => zurueckZu({ pfad, index, blatt: null })

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

  // Rückwärts rechnen: Tabelle auswerten, für das beste Konto live nachrechnen (Gründe und 5 Punkte darunter)
  useEffect(() => {
    if (pfad !== 'rueck' || phase !== 'rechnen' || !tabelleBereit || rueckBereit) return
    const id = window.setTimeout(() => {
      const a = JSON.parse(antwortSchl) as RueckAntworten
      const liste = loeseAntworten(tabelleBereit, a, eintraege)
      const b = liste[0]?.gewaehlt ? liste[0] : null
      let detail: RwDetail | null = null
      let darunter: RwDetail | null = null
      if (b && b.gewaehlt) {
        const z = b.gewaehlt
        detail = detailRueckwaerts(b.e.konto, z.trefferquote, z.crv, a.tpw, z.risikoIndex, a.monate, a.ziel)
        darunter = detailRueckwaerts(b.e.konto, Math.max(0.01, z.trefferquote - DARUNTER_PUNKTE / 100), z.crv, a.tpw, z.risikoIndex, a.monate, a.ziel)
      }
      setRueck({ schl: antwortSchl, liste, detail, darunter, fertigUm: performance.now() })
    }, ruhig ? 0 : 350)
    return () => window.clearTimeout(id)
  }, [pfad, phase, tabelleBereit, rueckBereit, antwortSchl, eintraege, ruhig])

  // Nach der Rechen-Animation (mindestens RECHNEN_MS) zum Fertig-Schirm
  const rechnenSeit = useRef(0)
  useEffect(() => {
    if (phase === 'rechnen') rechnenSeit.current = performance.now()
  }, [phase, schluessel])
  const rechnungFertig = pfad === 'rueck' ? rueckBereit !== null : rechnung.lauf.status === 'fertig' && !rechnung.veraltet
  useEffect(() => {
    if (phase !== 'rechnen' || !rechnungFertig) return
    const rest = ruhig ? 0 : Math.max(0, RECHNEN_MS - (performance.now() - rechnenSeit.current))
    const id = window.setTimeout(() => vor({ pfad, index: n + 1, blatt: null }, 1, true), rest)
    return () => window.clearTimeout(id)
  }, [phase, rechnungFertig, ruhig, vor, pfad, n])

  // Nach jedem Schrittwechsel: Bühne nach oben, Fokus auf die Frage (für Tastatur und Screenreader)
  const ersterRender = useRef(true)
  useEffect(() => {
    if (ersterRender.current) {
      ersterRender.current = false
      return
    }
    buehne.current?.scrollTo({ top: 0 })
    const id = window.setTimeout(() => frage.current?.focus({ preventScroll: true }), DAUER * 1000 + 40)
    return () => window.clearTimeout(id)
  }, [schluessel])

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
  const art = phase === 'frage' ? fragen[index] : null
  const weiterOk = phase !== 'frage' || pfad === 'rueck' || vorOk[art as (typeof VOR_FRAGEN)[number]]

  // Wischen: links = weiter (wenn die Antwort steht), rechts = zurück
  const wisch = (_: unknown, info: PanInfo) => {
    if (phase === 'rechnen') return
    const links = info.offset.x < -WISCH_PX || info.velocity.x < -WISCH_TEMPO
    const rechts = info.offset.x > WISCH_PX || info.velocity.x > WISCH_TEMPO
    if (links && Math.abs(info.offset.x) > Math.abs(info.offset.y)) {
      if (phase === 'frage' && weiterOk) weiter()
      else if (phase === 'fertig') zumErgebnis()
    } else if (rechts && Math.abs(info.offset.x) > Math.abs(info.offset.y)) {
      if (phase === 'ergebnis') zurueckZu({ pfad, index: n + 1, blatt: null })
      else zurueck()
    }
  }

  // Tastatur: Pfeil rechts oder Enter = Weiter, Pfeil links = Zurück. Nicht in Eingabefeldern, nicht bei offenem Blatt oder
  // Cookie-Dialog; Enter auf Knöpfen und Links bleibt deren eigener Klick.
  const taste = useRef<(e: KeyboardEvent) => void>(() => {})
  useEffect(() => {
    taste.current = (e: KeyboardEvent) => {
      if (blatt || phase === 'rechnen' || e.defaultPrevented || e.repeat || e.isComposing) return
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return
      const ziel = e.target instanceof Element ? e.target : null
      if (ziel?.closest('input, textarea, select, [contenteditable="true"], [role="dialog"], [role="radiogroup"]')) return
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return
      const vorwaerts = e.key === 'ArrowRight' || (e.key === 'Enter' && !ziel?.closest('button, a, summary, [role="button"]'))
      if (vorwaerts) {
        if (phase === 'frage' && weiterOk) weiter()
        else if (phase === 'fertig') zumErgebnis()
        else return
      } else if (e.key === 'ArrowLeft') {
        if (phase === 'ergebnis') zurueckZu({ pfad, index: n + 1, blatt: null })
        else if (index > 0 || pfad === 'vor') zurueck()
        else return
      } else return
      e.preventDefault()
    }
  })
  useEffect(() => {
    const beiTaste = (e: KeyboardEvent) => taste.current(e)
    window.addEventListener('keydown', beiTaste)
    return () => window.removeEventListener('keydown', beiTaste)
  }, [])

  const varianten = {
    rein: (d: number) => (ruhig ? { opacity: 0 } : { opacity: 0, x: d * 36 }),
    da: { opacity: 1, x: 0 },
    raus: (d: number) => (ruhig ? { opacity: 0 } : { opacity: 0, x: d * -36 }),
  }
  const crvText = (c: number) => t.f.zahlText(c, 1)

  // ---------------------------------------------------------------------------------------------- Inhalt der Bühne
  let inhalt: ReactNode = null
  const kopf = (f: { frage: string; unter: string; erklaerung: string }) => (
    <>
      <h2 className="wz-frage" ref={frage} tabIndex={-1}>{f.frage}</h2>
      <p className="wz-unter">{f.unter}</p>
      <Erklaerung titel={W.wasHeisst} klasse="erkl-frage">{f.erklaerung}</Erklaerung>
    </>
  )
  if (phase === 'frage' && pfad === 'rueck') {
    if (art === 'ziel') {
      inhalt = (
        <>
          {kopf(F.ziel)}
          <Optionen>
            {RW.ziele.map((z, i) => (
              <Chip key={z} i={i} an={antworten.ziel === z} onClick={() => waehle('ziel', z)}>{t.f.usd(z)}</Chip>
            ))}
          </Optionen>
          <p className="wz-abzweig">
            <button type="button" className="lnk-knopf" onClick={() => wechsle('vor')}>
              {W.kenneZahlen} <span aria-hidden="true">→</span>
              <small>{W.kenneZahlenKurz}</small>
            </button>
          </p>
        </>
      )
    } else if (art === 'zeit') {
      inhalt = (
        <>
          {kopf(F.zeit)}
          <Optionen>
            {RW.monate.map((m, i) => (
              <Chip key={m} i={i} an={antworten.monate === m} onClick={() => waehle('monate', m)}>{t.rueck.monateChip(m)}</Chip>
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
              <Chip key={x} i={i} an={antworten.tpw === x} onClick={() => waehle('tpw', x)} unter={W.proWoche}>{x}</Chip>
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
                <Chip key={c} i={i} an={antworten.crv === c} onClick={() => setAntworten((a) => ({ ...a, crv: c }))}>{`1 : ${crvText(c)}`}</Chip>
              ))}
            </Optionen>
            <CrvSkizze crv={antworten.crv} sprache={sprache} />
          </div>
        </>
      )
    } else if (art === 'sicher') {
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
    } else {
      inhalt = (
        <>
          {kopf(A.groesse)}
          <Optionen>
            {GROESSEN.map((g, i) => (
              <Chip key={g.schl} i={i} an={antworten.groesseMax === g.max} onClick={() => setAntworten((a) => ({ ...a, groesseMax: g.max }))}>
                {A.groessen[g.schl]}
              </Chip>
            ))}
          </Optionen>
        </>
      )
    }
  } else if (phase === 'frage') {
    const feldMitChips = (k: keyof Form, einheit: string, chips: number[], fmt: (x: number) => string) => (
      <div className="wz-eingabe">
        <Optionen>
          {chips.map((c, i) => (
            <Chip key={c} i={i} an={zahlAus(String(form[k]), sprache) === c} onClick={() => setzeForm(k, t.f.zahlText(c, 1))}>{fmt(c)}</Chip>
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
          <p className="wz-abzweig">
            <button type="button" className="lnk-knopf" onClick={() => wechsle('rueck')}>
              <span aria-hidden="true">←</span> {W.vomZiel}
            </button>
          </p>
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
  } else if (phase === 'rechnen') {
    const anteil = pfad === 'vor' && rechnung.lauf.gesamt ? rechnung.lauf.fertig / rechnung.lauf.gesamt : null
    inhalt = (
      <div className="wz-rechnen" role="status">
        <h2 className="wz-frage" ref={frage} tabIndex={-1}>
          {pfad === 'rueck' ? W.rechnet(tabelleBereit?.konten.length ?? 126) : A.rechnetVor(t.f.zahlText(form.pfade))}
        </h2>
        <div className="wz-rechnen-balken">
          {anteil === null ? (
            <motion.i initial={{ width: '0%' }} animate={{ width: '100%' }} transition={{ duration: ruhig ? 0 : RECHNEN_MS / 1000, ease: [0.4, 0, 0.2, 1] }} />
          ) : (
            <motion.i animate={{ width: `${Math.max(0.05, anteil) * 100}%` }} transition={{ duration: 0.2 }} />
          )}
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
  } else if (phase === 'fertig') {
    inhalt = (
      <div className="wz-fertig">
        <h2 className="wz-frage" ref={frage} tabIndex={-1}>{A.fertigTitel}</h2>
        <p className="wz-unter">{A.fertigUnter}</p>
        <CtaKarte sprache={sprache} ohneTitel />
      </div>
    )
  } else if (pfad === 'rueck') {
    inhalt = (
      <div className="wz-ergebnis">
        <h2 className="sr-only" ref={frage} tabIndex={-1}>{W.ergebnisKicker}</h2>
        {rueckBereit && (
          <RueckKlartext
            sprache={sprache}
            antworten={antworten}
            bester={rueckBereit.liste[0]?.gewaehlt ? rueckBereit.liste[0] : null}
            detail={rueckBereit.detail}
            darunter={rueckBereit.darunter}
            onAndere={() => oeffne('andere')}
          />
        )}
      </div>
    )
  } else {
    inhalt = (
      <div className="wz-ergebnis">
        <h2 className="sr-only" ref={frage} tabIndex={-1}>{W.vorKicker}</h2>
        <VorKlartext sprache={sprache} form={form} rechnung={rechnung} onAndere={() => oeffne('andere')} onAnnahmen={() => oeffne('annahmen')} />
      </div>
    )
  }

  // ---------------------------------------------------------------------------------------------- Navigation unten
  const punkte = n + 1
  const aktiverPunkt = Math.min(index, n)
  let nav: ReactNode = null
  if (phase === 'frage') {
    nav = (
      <>
        {index > 0 || pfad === 'vor' ? (
          <button type="button" className="knopf-leise" onClick={zurueck}><span aria-hidden="true">←</span> {W.zurueck}</button>
        ) : <span />}
        <button type="button" className="btn btn-inv wz-weiter" onClick={weiter} disabled={!weiterOk}>
          {index === n - 1 ? W.ergebnisZeigen : W.weiter} <span className="arr" aria-hidden="true">→</span>
        </button>
      </>
    )
  } else if (phase === 'fertig') {
    nav = (
      <>
        <button type="button" className="knopf-leise" onClick={zurueck}><span aria-hidden="true">←</span> {W.zurueck}</button>
        <button type="button" className="btn btn-accent wz-weiter wz-ansehen" onClick={zumErgebnis}>
          {A.ergebnisAnsehen} <span className="arr" aria-hidden="true">→</span>
        </button>
      </>
    )
  } else if (phase === 'ergebnis') {
    nav = (
      <>
        <button type="button" className="knopf-leise" onClick={() => wechsle('rueck')}>{A.neuRechnen}</button>
        <button type="button" className="btn btn-inv wz-weiter" onClick={() => wechsle(pfad === 'rueck' ? 'vor' : 'rueck')}>
          {pfad === 'rueck' ? A.eigeneZahlen : A.vomZiel} <span className="arr" aria-hidden="true">→</span>
        </button>
      </>
    )
  }

  return (
    <MotionConfig reducedMotion="user">
      <div className="pfr-app-innen">
        <header className="app-kopf">
          <Link className="app-marke" href="/" prefetch={false} aria-label={A.start}>
            <span className="mark" aria-hidden="true">
              <Image src="/landing/logo.jpg" alt="" width={26} height={26} sizes="26px" />
            </span>
          </Link>
          <h1 className="app-titel">{A.titel}</h1>
          <div className="app-rechts">
            <Sprachwahl sprache={sprache} />
            <span className="thema-voll"><ThemeSwitch sprache={sprache} /></span>
            <span className="thema-kompakt"><ThemeSwitch sprache={sprache} kompakt /></span>
          </div>
        </header>

        <div className="app-buehne" ref={buehne} role="region" aria-label={W.aria}>
          <AnimatePresence mode="wait" custom={richtung} initial={false}>
            <motion.div
              key={schluessel}
              className={`wz-schritt wz-p-${phase}`}
              custom={richtung}
              variants={varianten}
              initial="rein"
              animate="da"
              exit="raus"
              transition={{ duration: DAUER, ease: EASE }}
              drag={phase === 'rechnen' ? false : 'x'}
              dragDirectionLock
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.16}
              dragSnapToOrigin
              onDragEnd={wisch}
            >
              {inhalt}
            </motion.div>
          </AnimatePresence>
        </div>

        <footer className="app-fuss">
          {/* Fortschritt: reine Anzeige (zurück geht es mit „Zurück“, Wischen, Pfeil links oder Browser-Zurück) */}
          <div className="punkte" role="img" aria-label={A.punkt(aktiverPunkt + 1, punkte)}>
            {Array.from({ length: punkte }, (_, i) => (
              <span
                key={i}
                className="punkt"
                data-aktiv={i === aktiverPunkt ? '' : undefined}
                data-erledigt={i < aktiverPunkt ? '' : undefined}
              />
            ))}
          </div>
          {nav && <div className="app-nav">{nav}</div>}
          <nav className="app-recht" aria-label={A.rechtliches}>
            <button type="button" onClick={() => oeffne('methode')}>{A.soRechnet}</button>
            <Link href="/impressum" prefetch={false} hrefLang={sprache === 'en' ? 'de' : undefined}>{A.impressum}</Link>
            <Link href="/datenschutz" prefetch={false} hrefLang={sprache === 'en' ? 'de' : undefined}>{A.datenschutz}</Link>
            <button type="button" onClick={openCookieSettings}>{A.cookies}</button>
            <span className="app-hinweis">{A.keineBeratung}</span>
          </nav>
        </footer>

        <Blatt id="blatt-methode" offen={blatt === 'methode'} onClose={schliesse} titel={A.soRechnet} schliessen={A.schliessen}>
          <Hintergrund daten={DATEN} sprache={sprache} />
          <SiteFooter sprache={sprache} />
        </Blatt>
        <Blatt id="blatt-andere" offen={blatt === 'andere'} onClose={schliesse} titel={A.andereTitel} schliessen={A.schliessen}>
          <div className="blatt-wrap">
            {pfad === 'rueck' && rueckBereit ? (
              <KontenListe sprache={sprache} liste={rueckBereit.liste} antworten={antworten} />
            ) : (
              <VorKonten sprache={sprache} rechnung={rechnung} />
            )}
          </div>
        </Blatt>
        <Blatt id="blatt-annahmen" offen={blatt === 'annahmen'} onClose={schliesse} titel={A.annahmen} schliessen={A.schliessen}>
          <div className="blatt-wrap">
            <VorAnnahmen sprache={sprache} form={form} setForm={setForm} />
          </div>
        </Blatt>
      </div>
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
