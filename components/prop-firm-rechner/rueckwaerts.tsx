'use client'

import { useEffect, useMemo, useState } from 'react'
import rohDaten from '@/lib/prop-firm/daten/regeln-2026-10-09.json'
import { ladeTabelle } from '@/lib/prop-firm/daten/rueckwaerts'
import { ladeKonten, type KontoEintrag, type RegelDaten } from '@/lib/prop-firm/konten'
import { RW, anforderungAusTabelle, detailRueckwaerts, erwartungBeiCrv, type RwDetail, type RwTabelle } from '@/lib/prop-firm/rueckwaerts'
import { unterzeile } from './ergebnisse'
import { Feld, Wahl, zahlAus } from './rechner'
import { Scheitern } from './scheitern'
import { RUECK_START } from './start'
import { woerterbuch, type Sprache, type Woerterbuch } from './texte'

const DATEN = rohDaten as unknown as RegelDaten
/** So viele Karten zuerst; der Rest auf Knopfdruck */
const ERSTE_KARTEN = 8

type Zelle = { crv: number; trefferquote: number; risikoIndex: number; erwartung: number } | null
type Zeile = { e: KontoEintrag; zellen: Zelle[]; leicht: Zelle }

/** Drawdown, auf den sich „Risiko als Anteil am Drawdown“ bezieht (erste Phase des Kontotyps). */
function drawdown(e: KontoEintrag): number | null {
  return e.konto.phasen[0]?.dd_betrag ?? null
}

function risikoText(e: KontoEintrag, risikoIndex: number, t: Woerterbuch, satz = false): string {
  const anteil = RW.risiko[risikoIndex]
  const dd = drawdown(e)
  return (satz ? t.rueck.risikoSatz : t.rueck.risikoKurz)(t.f.prozent(anteil * 100), dd ? t.f.usd(anteil * dd) : t.f.ka)
}

/** Rückwärts (Standard): Ziel in USD bis zu einem Zeitpunkt → nötige Trefferquote je Kontotyp und CRV. */
export function Rueckwaerts({ sprache }: { sprache: Sprache }) {
  const t = woerterbuch(sprache)
  const Q = t.rueck
  const { usd, pct } = t.f
  const eintraege = useMemo(() => new Map(ladeKonten(DATEN).map((e) => [e.id, e])), [])
  const [zielText, setZielText] = useState(() => t.f.zahlText(RUECK_START.ziel))
  const [monate, setMonate] = useState<number>(RUECK_START.monate)
  const [tpw, setTpw] = useState<number>(RUECK_START.tradesProWoche)
  const [sicherheit, setSicherheit] = useState<number>(RUECK_START.sicherheit)
  const [geladen, setGeladen] = useState<{ schl: string; tabelle: RwTabelle } | null>(null)
  const [ladeFehler, setLadeFehler] = useState(false)
  const [offen, setOffen] = useState<string | null>(null)
  const [alle, setAlle] = useState(false)

  const schl = `${tpw}-${monate}`
  useEffect(() => {
    let aktiv = true
    ladeTabelle(tpw, monate)
      .then((tabelle) => {
        if (aktiv) setGeladen({ schl: `${tpw}-${monate}`, tabelle })
      })
      .catch(() => {
        if (aktiv) setLadeFehler(true)
      })
    return () => {
      aktiv = false
    }
  }, [tpw, monate])

  const tabelle = geladen?.schl === schl ? geladen.tabelle : null
  const ziel = zahlAus(zielText, sprache)
  const zielOk = Number.isFinite(ziel) && ziel >= RW.ziele[0] && ziel <= RW.ziele[RW.ziele.length - 1]

  const liste: Zeile[] = useMemo(() => {
    if (!tabelle || !zielOk) return []
    const si = tabelle.sicherheit.indexOf(sicherheit)
    const zeilen: Zeile[] = []
    tabelle.konten.forEach((id, ki) => {
      const e = eintraege.get(id)
      if (!e) return
      const zellen: Zelle[] = tabelle.crv.map((crv, ci) => {
        const a = anforderungAusTabelle(tabelle, ki, ci, si, ziel)
        if (!a) return null
        // auf ganze Prozent aufrunden: die angezeigte Trefferquote reicht dann sicher für die gewählte Sicherheit
        const p = Math.ceil(a.trefferquote * 100 - 1e-9) / 100
        return { crv, trefferquote: p, risikoIndex: a.risikoIndex, erwartung: erwartungBeiCrv(p, crv) }
      })
      const moeglich = zellen.filter((z): z is NonNullable<Zelle> => z !== null)
      const leicht = moeglich.length ? moeglich.reduce((a, b) => (b.erwartung < a.erwartung ? b : a)) : null
      zeilen.push({ e, zellen, leicht })
    })
    return zeilen.sort((a, b) => {
      if (!a.leicht && !b.leicht) return 0
      if (!a.leicht) return 1
      if (!b.leicht) return -1
      return a.leicht.erwartung - b.leicht.erwartung
    })
  }, [tabelle, zielOk, sicherheit, ziel, eintraege])

  const erster = liste[0]?.leicht ? liste[0] : null
  const crvText = (c: number) => t.f.zahlText(c, 1)
  const name = (e: KontoEintrag) => `${e.firma} ${t.f.groesseKurz(e.groesse)}`
  const sichtbar = alle ? liste : liste.slice(0, ERSTE_KARTEN)

  return (
    <div className="rueck">
      {erster && erster.leicht && (
        <p className="zf-kurz" aria-hidden="true">
          <b className="num">{pct(erster.leicht.trefferquote)}</b> {Q.crv(crvText(erster.leicht.crv))} · {name(erster.e)}
          <small>{Q.kurzBester}</small>
        </p>
      )}
      <form className="eingabe-feld" aria-labelledby="rueck-eingabe" onSubmit={(ev) => ev.preventDefault()}>
        <p className="ebene" id="rueck-eingabe">{t.modi.eingabe}</p>
        <div className="eingabe-rueck">
          <Feld label={Q.ziel} einheit="USD" wert={zielText} onChange={setZielText} hilfe={Q.zielHilfe} />
          <div className="feld">
            <span id="zeit-l">{Q.zeitraum}</span>
            <Wahl label="zeit-l" wert={String(monate)} onChange={(v) => setMonate(Number(v))} optionen={RW.monate.map((m) => [String(m), Q.monateChip(m)] as [string, string])} />
          </div>
          <div className="feld">
            <span id="tpw-l">{Q.trades}</span>
            <Wahl label="tpw-l" wert={String(tpw)} onChange={(v) => setTpw(Number(v))} optionen={RW.tradesProWoche.map((x) => [String(x), String(x)] as [string, string])} />
          </div>
          <div className="feld">
            <span id="sicher-l">{Q.sicherheit}</span>
            <Wahl label="sicher-l" wert={String(sicherheit)} onChange={(v) => setSicherheit(Number(v))} optionen={RW.sicherheit.map((x) => [String(x), Q.sicherheitOption(x)] as [string, string])} />
            <span className="hilfe">{Q.sicherheitHilfe}</span>
          </div>
        </div>
        {!zielOk && <p className="warnung" role="alert">{Q.zielGrenze(usd(RW.ziele[0]), usd(RW.ziele[RW.ziele.length - 1]))}</p>}
      </form>

      <section className="zusammenfassung" aria-live="polite" aria-labelledby="rueck-ergebnis">
        <p className="ebene" id="rueck-ergebnis">{t.modi.ergebnis}</p>
        {ladeFehler ? (
          <p className="zf-satz">{Q.ladeFehler}</p>
        ) : !tabelle ? (
          <p className="zf-satz">{Q.laden}</p>
        ) : erster && erster.leicht ? (
          <>
            <p className="zf-zahl">
              <b className="num">{pct(erster.leicht.trefferquote)}</b>
              <span>{Q.crv(crvText(erster.leicht.crv))}</span>
            </p>
            <p className="zf-satz">
              {Q.zusammenfassung(name(erster.e), pct(erster.leicht.trefferquote), crvText(erster.leicht.crv), risikoText(erster.e, erster.leicht.risikoIndex, t, true))}{' '}
              <span className="zf-klein">{unterzeile(erster.e, t)}</span>
            </p>
            <p className="zf-satz zf-klein">{erwartungSatz(erster.e, erster.leicht, t)}</p>
          </>
        ) : zielOk ? (
          <p className="zf-satz">{Q.keinKonto}</p>
        ) : null}
        <details className="warum">
          <summary>{t.modi.warum}</summary>
          <p>{Q.soGerechnetText(t.f.zahlText(tabelle?.pfade ?? RW.pfade))}</p>
          <p>{Q.sortiert}</p>
        </details>
      </section>

      {tabelle && zielOk && (
        <section className="rw-liste" aria-label={t.ergebnis.alleTitel}>
          <p className="klein rw-hinweis">{Q.sortiert}</p>
          <ol>
            {sichtbar.map(({ e, zellen, leicht }) => {
              const auf = offen === e.id
              return (
                <li key={e.id} className={`rw-karte${auf ? ' offen' : ''}${leicht ? '' : ' kaum'}`}>
                  <button type="button" className="rw-kopf" aria-expanded={auf} onClick={() => setOffen(auf ? null : e.id)}>
                    <span className="rw-name">
                      {name(e)}
                      <small>{unterzeile(e, t)}</small>
                    </span>
                    {leicht ? (
                      <span className="rw-haupt">
                        <b className="num">{pct(leicht.trefferquote)}</b>
                        <small>{Q.crv(crvText(leicht.crv))}</small>
                      </span>
                    ) : (
                      <span className="rw-haupt rw-kaum">{Q.kaum}</span>
                    )}
                  </button>
                  <div className="rw-zellen">
                    {zellen.map((z, ci) => (
                      <div key={ci} className={`rw-zelle${z && leicht && z.crv === leicht.crv ? ' leicht' : ''}`}>
                        <span>{Q.crv(crvText(RW.crv[ci]))}</span>
                        <b className="num">{z ? pct(z.trefferquote) : '·'}</b>
                        <small>{z ? risikoText(e, z.risikoIndex, t) : Q.kaum}</small>
                      </div>
                    ))}
                  </div>
                  {auf && leicht && (
                    <RwDetails e={e} zelle={leicht} tpw={tpw} monate={monate} ziel={ziel} sprache={sprache} />
                  )}
                </li>
              )
            })}
          </ol>
          {liste.length > ERSTE_KARTEN && (
            <div className="mehr">
              <button type="button" className="knopf-leise" aria-expanded={alle} onClick={() => setAlle(!alle)}>
                {alle ? Q.weniger : Q.mehr(liste.length)}
              </button>
            </div>
          )}
        </section>
      )}
    </div>
  )
}

function erwartungSatz(e: KontoEintrag, z: NonNullable<Zelle>, t: Woerterbuch): string {
  const dd = drawdown(e)
  const risiko = dd ? RW.risiko[z.risikoIndex] * dd : null
  return t.rueck.erwartung(t.f.r(z.erwartung), risiko !== null ? t.f.usd(z.erwartung * risiko) : t.f.ka, risiko !== null ? t.f.usd(risiko) : t.f.ka)
}

/** Aufgeklappte Karte: Live-Rechnung für diesen Kontotyp (Woran es scheitert, Vergleich ohne Vorteil), Regeln und Kosten. */
function RwDetails({ e, zelle, tpw, monate, ziel, sprache }: {
  e: KontoEintrag
  zelle: NonNullable<Zelle>
  tpw: number
  monate: number
  ziel: number
  sprache: Sprache
}) {
  const t = woerterbuch(sprache)
  const Q = t.rueck
  const D = t.details
  const [detail, setDetail] = useState<{ schl: string; wert: RwDetail } | null>(null)
  const schl = `${e.id}|${zelle.crv}|${zelle.trefferquote}|${zelle.risikoIndex}|${tpw}|${monate}|${ziel}`
  useEffect(() => {
    // kurz warten, damit „Rechnet …“ erst gezeichnet wird; die Rechnung selbst dauert je nach Gerät 0,05 bis 0,5 s
    const id = window.setTimeout(() => {
      const wert = detailRueckwaerts(e.konto, zelle.trefferquote, zelle.crv, tpw, zelle.risikoIndex, monate, ziel)
      setDetail({ schl, wert })
    }, 30)
    return () => window.clearTimeout(id)
  }, [schl, e.konto, zelle, tpw, monate, ziel])
  const d = detail?.schl === schl ? detail.wert : null
  const zeit = Q.monate(monate)
  return (
    <div className="rw-details">
      <p className="rw-details-kopf">
        {Q.detailsFuer(t.f.zahlText(zelle.crv, 1), t.f.pct(zelle.trefferquote), risikoText(e, zelle.risikoIndex, t, true))}
      </p>
      <p>{erwartungSatz(e, zelle, t)}</p>
      {!d ? (
        <p className="klein">{Q.detailsRechnen}</p>
      ) : (
        <>
          <p>
            {Q.erreicht(t.f.pct(d.erreicht), t.f.usd(ziel), zeit)} {Q.median(t.f.usd(d.median, true), zeit)}
          </p>
          <Scheitern anteile={d} sprache={sprache} />
          <p className="details-vergleich">{Q.vergleich(t.f.usd(d.medianOhneVorteil, true), zeit)}</p>
        </>
      )}
      <details className="warum">
        <summary>{Q.regelnZeigen}</summary>
        <h4>{D.regeln}</h4>
        {t.regelSaetze(e.konto).map((p) => (
          <p key={p.titel} className="phase">
            <b>{p.titel}:</b> {p.saetze.join('; ')}.
          </p>
        ))}
        <h4>{D.kosten}</h4>
        <ul>
          {t.kostenSaetze(e.konto, false).map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
        <h4>{D.quellen(t.f.datum(DATEN.stand))}</h4>
        <ul>
          {e.quellen.slice(0, 6).map((q) => {
            const quelle = DATEN.quellen[q]
            if (!quelle) return null
            return (
              <li key={q}>
                <a href={quelle.url} target="_blank" rel="noopener noreferrer nofollow">
                  {t.daten.quelleTitel({ id: q, ...quelle })}
                </a>
              </li>
            )
          })}
        </ul>
      </details>
    </div>
  )
}
