'use client'

import { useEffect, useMemo, useState } from 'react'
import rohDaten from '@/lib/prop-firm/daten/regeln-2026-10-09.json'
import { ladeKonten, type KontoEintrag, type RegelDaten } from '@/lib/prop-firm/konten'
import { RW, anforderungAusTabelle, detailRueckwaerts, erwartungBeiCrv, type RwDetail, type RwTabelle } from '@/lib/prop-firm/rueckwaerts'
import { Erklaerung, Herein, Zaehler } from './bewegung'
import { unterzeile } from './ergebnisse'
import { Scheitern } from './scheitern'
import { woerterbuch, type Sprache, type Woerterbuch } from './texte'

const DATEN = rohDaten as unknown as RegelDaten
/** So viele weitere Konten zuerst; der Rest auf Knopfdruck */
const ERSTE_KARTEN = 8

export type RueckAntworten = { ziel: number; monate: number; tpw: number; crv: number; sicherheit: number }

type Zelle = { crv: number; trefferquote: number; risikoIndex: number; erwartung: number } | null
type Zeile = { e: KontoEintrag; zellen: Zelle[]; gewaehlt: Zelle }

/** Drawdown, auf den sich „Risiko als Anteil am Drawdown“ bezieht (erste Phase des Kontotyps). */
function drawdown(e: KontoEintrag): number | null {
  return e.konto.phasen[0]?.dd_betrag ?? null
}

function risikoText(e: KontoEintrag, risikoIndex: number, t: Woerterbuch, satz = false): string {
  const anteil = RW.risiko[risikoIndex]
  const dd = drawdown(e)
  return (satz ? t.rueck.risikoSatz : t.rueck.risikoKurz)(t.f.prozent(anteil * 100), dd ? t.f.usd(anteil * dd) : t.f.ka)
}

function erwartungSatz(e: KontoEintrag, z: NonNullable<Zelle>, t: Woerterbuch): string {
  const dd = drawdown(e)
  const risiko = dd ? RW.risiko[z.risikoIndex] * dd : null
  return t.rueck.erwartung(t.f.r(z.erwartung), risiko !== null ? t.f.usd(z.erwartung * risiko) : t.f.ka, risiko !== null ? t.f.usd(risiko) : t.f.ka)
}

/** Nötige Trefferquoten je Kontotyp aus der Tabelle, sortiert nach der Anforderung beim gewählten CRV. */
export function loeseAntworten(tabelle: RwTabelle, a: RueckAntworten, eintraege: Map<string, KontoEintrag>): Zeile[] {
  const si = tabelle.sicherheit.indexOf(a.sicherheit)
  const zeilen: Zeile[] = []
  tabelle.konten.forEach((id, ki) => {
    const e = eintraege.get(id)
    if (!e) return
    const zellen: Zelle[] = tabelle.crv.map((crv, ci) => {
      const x = anforderungAusTabelle(tabelle, ki, ci, si, a.ziel)
      if (!x) return null
      // auf ganze Prozent aufrunden: die angezeigte Trefferquote reicht dann sicher für die gewählte Sicherheit
      const p = Math.ceil(x.trefferquote * 100 - 1e-9) / 100
      return { crv, trefferquote: p, risikoIndex: x.risikoIndex, erwartung: erwartungBeiCrv(p, crv) }
    })
    zeilen.push({ e, zellen, gewaehlt: zellen[tabelle.crv.indexOf(a.crv)] ?? null })
  })
  return zeilen.sort((x, y) => {
    if (!x.gewaehlt && !y.gewaehlt) return 0
    if (!x.gewaehlt) return 1
    if (!y.gewaehlt) return -1
    return x.gewaehlt.trefferquote - y.gewaehlt.trefferquote || x.gewaehlt.risikoIndex - y.gewaehlt.risikoIndex
  })
}

/** Ergebnis rückwärts: bestes Konto für genau diese Antworten, woran es scheitert, dann die weiteren Konten. */
export function RueckErgebnis({ sprache, tabelle, antworten, onAendern }: {
  sprache: Sprache
  tabelle: RwTabelle
  antworten: RueckAntworten
  onAendern: () => void
}) {
  const t = woerterbuch(sprache)
  const W = t.wz
  const Q = t.rueck
  const { pct, usd } = t.f
  const eintraege = useMemo(() => new Map(ladeKonten(DATEN).map((e) => [e.id, e])), [])
  const liste = useMemo(() => loeseAntworten(tabelle, antworten, eintraege), [tabelle, antworten, eintraege])
  const [offen, setOffen] = useState<string | null>(null)
  const [alle, setAlle] = useState(false)
  const bester = liste[0]?.gewaehlt ? liste[0] : null
  const weitere = liste.slice(bester ? 1 : 0)
  const sichtbar = alle ? weitere : weitere.slice(0, ERSTE_KARTEN)
  const crvText = (c: number) => t.f.zahlText(c, 1)
  const name = (e: KontoEintrag) => `${e.firma} ${t.f.groesseKurz(e.groesse)}`
  const zeit = Q.monate(antworten.monate)

  return (
    <div className="rueck-ergebnis">
      <section className="zusammenfassung" aria-labelledby="rueck-ergebnis">
        <p className="ebene" id="rueck-ergebnis">{W.ergebnisKicker}</p>
        {bester && bester.gewaehlt ? (
          <>
            <p className="zf-name">
              {name(bester.e)} <span className="zf-braucht">{W.braucht}</span>
              <small>{unterzeile(bester.e, t)}</small>
            </p>
            <p className="zf-zahl">
              <b className="num">
                <Zaehler wert={bester.gewaehlt.trefferquote} format={(x) => pct(x)} />
              </b>
              <span>
                {W.trefferquote} {W.beiCrv(crvText(antworten.crv))}
              </span>
            </p>
            <p className="zf-satz">{risikoText(bester.e, bester.gewaehlt.risikoIndex, t, true)}</p>
            <Erklaerung titel={W.wasHeisst}>
              <p>{erwartungSatz(bester.e, bester.gewaehlt, t)}</p>
              <p>{Q.soGerechnetText(t.f.zahlText(tabelle.pfade))}</p>
            </Erklaerung>
            <RwDetails e={bester.e} zelle={bester.gewaehlt} antworten={antworten} sprache={sprache} mitRegeln={false} />
          </>
        ) : (
          <p className="zf-satz">{W.keinKonto(crvText(antworten.crv))}</p>
        )}
        <div className="zf-antworten">
          <span>{W.antworten(usd(antworten.ziel), zeit, String(antworten.tpw), antworten.sicherheit)} · {Q.crv(crvText(antworten.crv))}</span>
          <button type="button" className="lnk-knopf" onClick={onAendern}>{W.aendern}</button>
        </div>
      </section>

      {weitere.length > 0 && (
        <section className="rw-liste" aria-labelledby="rw-weitere">
          <h3 id="rw-weitere">{W.weitere}</h3>
          <p className="klein rw-hinweis">{W.weitereUnter}</p>
          <ol>
            {sichtbar.map(({ e, zellen, gewaehlt }, i) => {
              const auf = offen === e.id
              return (
                <Herein key={e.id} i={i} klasse={`rw-karte${auf ? ' offen' : ''}${gewaehlt ? '' : ' kaum'}`}>
                  <button type="button" className="rw-kopf" aria-expanded={auf} onClick={() => setOffen(auf ? null : e.id)}>
                    <span className="rw-name">
                      {name(e)}
                      <small>{unterzeile(e, t)}</small>
                    </span>
                    {gewaehlt ? (
                      <span className="rw-haupt">
                        <b className="num">{pct(gewaehlt.trefferquote)}</b>
                        <small>{risikoText(e, gewaehlt.risikoIndex, t)}</small>
                      </span>
                    ) : (
                      <span className="rw-haupt rw-kaum">{Q.kaum}</span>
                    )}
                  </button>
                  {auf && (
                    <div className="rw-auf">
                      <p className="rw-andere-titel">{W.andereCrv}</p>
                      <div className="rw-zellen">
                        {zellen.map((z, ci) => (
                          <div key={ci} className={`rw-zelle${RW.crv[ci] === antworten.crv ? ' leicht' : ''}`}>
                            <span>{Q.crv(crvText(RW.crv[ci]))}</span>
                            <b className="num">{z ? pct(z.trefferquote) : '·'}</b>
                            <small>{z ? risikoText(e, z.risikoIndex, t) : Q.kaum}</small>
                          </div>
                        ))}
                      </div>
                      {gewaehlt && <RwDetails e={e} zelle={gewaehlt} antworten={antworten} sprache={sprache} mitRegeln />}
                    </div>
                  )}
                </Herein>
              )
            })}
          </ol>
          {weitere.length > ERSTE_KARTEN && (
            <div className="mehr">
              <button type="button" className="knopf-leise" aria-expanded={alle} onClick={() => setAlle(!alle)}>
                {alle ? Q.weniger : Q.mehr(weitere.length)}
              </button>
            </div>
          )}
        </section>
      )}
    </div>
  )
}

/** Live-Rechnung für einen Kontotyp (Woran es scheitert, Vergleich ohne Vorteil), auf Wunsch Regeln und Kosten. */
function RwDetails({ e, zelle, antworten, sprache, mitRegeln }: {
  e: KontoEintrag
  zelle: NonNullable<Zelle>
  antworten: RueckAntworten
  sprache: Sprache
  mitRegeln: boolean
}) {
  const t = woerterbuch(sprache)
  const Q = t.rueck
  const D = t.details
  const [detail, setDetail] = useState<{ schl: string; wert: RwDetail } | null>(null)
  const schl = `${e.id}|${zelle.crv}|${zelle.trefferquote}|${zelle.risikoIndex}|${antworten.tpw}|${antworten.monate}|${antworten.ziel}`
  useEffect(() => {
    // kurz warten, damit die Karte erst aufgeht; die Rechnung selbst dauert je nach Gerät 0,05 bis 0,5 s
    const id = window.setTimeout(() => {
      const wert = detailRueckwaerts(e.konto, zelle.trefferquote, zelle.crv, antworten.tpw, zelle.risikoIndex, antworten.monate, antworten.ziel)
      setDetail({ schl, wert })
    }, 60)
    return () => window.clearTimeout(id)
  }, [schl, e.konto, zelle, antworten])
  const d = detail?.schl === schl ? detail.wert : null
  const zeit = Q.monate(antworten.monate)
  return (
    <div className="rw-details">
      {mitRegeln && <p className="rw-details-kopf">{Q.detailsFuer(t.f.zahlText(zelle.crv, 1), t.f.pct(zelle.trefferquote), risikoText(e, zelle.risikoIndex, t, true))}</p>}
      {!d ? (
        <p className="klein">{Q.detailsRechnen}</p>
      ) : (
        <>
          <p className="rw-erreicht">
            {Q.erreicht(t.f.pct(d.erreicht), t.f.usd(antworten.ziel), zeit)} {Q.median(t.f.usd(d.median, true), zeit)}
          </p>
          <Scheitern anteile={d} sprache={sprache} />
          <p className="details-vergleich">{Q.vergleich(t.f.usd(d.medianOhneVorteil, true), zeit)}</p>
        </>
      )}
      {mitRegeln && (
        <Erklaerung titel={Q.regelnZeigen}>
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
        </Erklaerung>
      )}
    </div>
  )
}
