#!/usr/bin/env node
/**
 * Prop-Firm-Rechner: rechnet die Tabelle für den Rückwärts-Modus vorab (lib/prop-firm/daten/rueckwaerts/*.json).
 *
 * Raster (lib/prop-firm/rueckwaerts.ts, RW): Trades pro Woche × CRV × Trefferquote × Kontotyp × Risiko (Anteil am
 * Drawdown) mit je RW.pfade simulierten Konto-Plätzen (12 Monate, Nachkauf, Auszahlungsweg A). Daraus je Zeitraum,
 * Sicherheit und Ziel die nötige Trefferquote mit dem günstigsten Risiko. Gemeinsame Zufallszahlen über das ganze Raster.
 *
 * Aufruf: node scripts/prop-firm-rueckwaerts.mjs [--threads N] [--nur-neu]
 * Ausgabe: eine Datei je (Trades pro Woche, Zeitraum), geladen erst, wenn der Rechner sie braucht.
 *
 * --nur-neu: rechnet nur (Trades pro Woche, CRV)-Paare, die in den vorhandenen Tabellen fehlen, und übernimmt die übrigen
 * Werte unverändert. Das ist gleichwertig zur vollen Rechnung, weil jede Zelle nur von ihrem eigenen Paar abhängt
 * (gleiche Zufallszahlen, gleiche Kontotypen, gleiches Raster für Risiko, Sicherheit, Ziele und Pfade; wird geprüft).
 * Der Test „Stichproben der Tabelle stimmen mit einer Live-Rechnung überein“ deckt alte und neue Zellen ab.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { cpus } from 'node:os'
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads'
import { registriereTs } from '../lib/prop-firm/ts-hooks.mjs'

await registriereTs()
const RWM = await import('../lib/prop-firm/rueckwaerts.ts')
const KON = await import('../lib/prop-firm/konten.ts')
const { RW } = RWM

const WURZEL = new URL('../', import.meta.url)
const DATEN = JSON.parse(readFileSync(new URL('lib/prop-firm/daten/regeln-2026-10-09.json', WURZEL), 'utf8'))
/** Rückwärts-Modus: nur aktuell angebotene Kontotypen mit bekanntem Preis, Standard-Lesart der Regeln. */
export function rwKonten() {
  return KON.ladeKonten(DATEN)
    .filter((e) => e.aktiv && e.konto.preis !== null)
    .map((e) => ({ id: e.id, konto: e.konto }))
}

if (!isMainThread) {
  // Auftrag: (Trades pro Woche, CRV, Trefferquote) für alle Kontotypen -> Quantile je Konto
  const konten = rwKonten()
  parentPort.on('message', (a) => {
    if (a === null) {
      process.exit(0)
    }
    const staende = RWM.nettoStaende(konten, a.p, a.crv, a.tpw)
    const q = staende.map((s) => (s ? RWM.quantile(s) : null))
    parentPort.postMessage({ ...a, q })
  })
} else {
  const arg = process.argv.indexOf('--threads')
  const threads = arg > 0 ? Number(process.argv[arg + 1]) : Math.max(1, cpus().length - 2)
  const nurNeu = process.argv.includes('--nur-neu')
  const konten = rwKonten()
  const ziel = new URL('lib/prop-firm/daten/rueckwaerts/', WURZEL)
  const gleich = (a, b) => JSON.stringify(a) === JSON.stringify(b)
  // vorhandene Tabellen (nur mit --nur-neu): müssen bis auf CRV und Version zum Raster passen
  const alt = new Map()
  if (nurNeu) {
    for (const tpw of RW.tradesProWoche) {
      for (const monate of RW.monate) {
        let t
        try {
          t = JSON.parse(readFileSync(new URL(`tpw${tpw}-m${monate}.json`, ziel), 'utf8'))
        } catch (err) {
          if (err.code === 'ENOENT') continue
          throw err
        }
        const passt = t.stand === DATEN.stand && t.pfade === RW.pfade && t.tradesProWoche === tpw && t.monate === monate &&
          gleich(t.risiko, RW.risiko) && gleich(t.sicherheit, RW.sicherheit) && gleich(t.ziele, RW.ziele) && gleich(t.konten, konten.map((k) => k.id))
        if (!passt) throw new Error(`tpw${tpw}-m${monate}.json passt nicht zum Raster, bitte ohne --nur-neu rechnen`)
        alt.set(`${tpw}|${monate}`, t)
      }
    }
  }
  const vorhanden = (tpw, crv) => RW.monate.every((m) => alt.get(`${tpw}|${m}`)?.crv.includes(crv))
  const auftraege = []
  for (const tpw of RW.tradesProWoche) {
    for (const crv of RW.crv) {
      if (vorhanden(tpw, crv)) continue
      RW.trefferquoten.forEach((p, pi) => auftraege.push({ tpw, crv, p, pi }))
    }
  }
  // teure Aufträge (viele Trades) zuerst, damit am Ende nicht ein Faden allein rechnet
  auftraege.sort((a, b) => b.tpw - a.tpw)
  console.log(`${konten.length} Kontotypen, ${auftraege.length} Aufträge, ${threads} Fäden, ${RW.pfade} Pfade, ${alt.size} Tabellen übernommen`)
  const t0 = performance.now()
  const ergebnisse = new Map() // `${tpw}|${crv}` -> Array[pi] von (Float64Array|null)[] je Konto
  let fertig = 0
  await new Promise((resolve, reject) => {
    let offen = auftraege.length
    let naechster = 0
    for (let w = 0; w < Math.min(threads, auftraege.length); w++) {
      const worker = new Worker(new URL(import.meta.url))
      const gib = () => worker.postMessage(naechster < auftraege.length ? auftraege[naechster++] : null)
      worker.on('message', (m) => {
        const schl = `${m.tpw}|${m.crv}`
        if (!ergebnisse.has(schl)) ergebnisse.set(schl, new Array(RW.trefferquoten.length))
        ergebnisse.get(schl)[m.pi] = m.q
        fertig++
        if (fertig % 10 === 0) console.log(`  ${fertig}/${auftraege.length} (${((performance.now() - t0) / 1000).toFixed(0)} s, zuletzt ${m.tpw}/Woche CRV ${m.crv})`)
        if (--offen === 0) resolve()
        gib()
      })
      worker.on('error', reject)
      gib()
    }
  })
  const sekunden = (performance.now() - t0) / 1000
  console.log(`gerechnet in ${sekunden.toFixed(0)} s`)

  mkdirSync(ziel, { recursive: true })
  let bytes = 0
  for (const tpw of RW.tradesProWoche) {
    RW.monate.forEach((monate, mi) => {
      const werte = []
      konten.forEach((k, ki) => {
        RW.crv.forEach((crv) => {
          if (!ergebnisse.has(`${tpw}|${crv}`)) {
            // unverändert aus der vorhandenen Tabelle
            const a = alt.get(`${tpw}|${monate}`)
            const n = RW.sicherheit.length * RW.ziele.length
            const basis = (ki * a.crv.length + a.crv.indexOf(crv)) * n
            werte.push(...a.werte.slice(basis, basis + n))
            return
          }
          const jeP = ergebnisse.get(`${tpw}|${crv}`).map((qs) => qs[ki])
          if (jeP.some((q) => q === null)) {
            for (let i = 0; i < RW.sicherheit.length * RW.ziele.length; i++) werte.push(-1)
            return
          }
          werte.push(...RWM.loese(jeP, mi))
        })
      })
      const tabelle = {
        version: RW.version, stand: DATEN.stand, tradesProWoche: tpw, monate, pfade: RW.pfade, crv: [...RW.crv], risiko: [...RW.risiko],
        sicherheit: [...RW.sicherheit], ziele: [...RW.ziele], konten: konten.map((k) => k.id), werte,
      }
      const text = JSON.stringify(tabelle)
      bytes += text.length
      writeFileSync(new URL(`tpw${tpw}-m${monate}.json`, ziel), text)
    })
  }
  console.log(`${RW.tradesProWoche.length * RW.monate.length} Dateien, zusammen ${(bytes / 1024).toFixed(0)} KB`)
  process.exit(0)
}
