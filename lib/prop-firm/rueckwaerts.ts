/**
 * Prop-Firm-Rechner, Rückwärts-Modus: Welche Trefferquote braucht ein Kontotyp, damit nach H Monaten mindestens Z USD
 * netto ausgezahlt sind (alle Auszahlungen nach Split minus alle Gebühren: Käufe, Abos, Resets, Aktivierung,
 * Fixkosten), und das in X von 10 simulierten Fällen?
 *
 * Grundlage ist ein Konto-Platz mit Nachkauf (kern.kampagne, Auszahlungsweg A „Nimm und geh“) über 12 Monate. Aus dem
 * Geldfluss einer Kampagne ergibt sich der Netto-Stand nach 1, 2, 3, 6 und 12 Monaten. Je Kontotyp, CRV, Risiko
 * (Anteil am Drawdown) und Trefferquote aus einem festen Raster wird mit denselben Zufallszahlen gerechnet
 * (gemeinsame Zufallszahlen: höhere Trefferquote macht nur Verlierer zu Gewinnern). Die nötige Trefferquote ist die
 * kleinste Rasterstelle, ab der das Ziel durchgehend erreicht wird, linear zwischen zwei Rasterstellen eingepasst.
 *
 * Dieselben Funktionen erzeugen die vorab gerechnete Tabelle (scripts/prop-firm-rueckwaerts.mjs) und prüfen sie im
 * Test gegen eine Live-Rechnung.
 */
import { MONAT, NichtSimulierbar, PERP_STANDARD, groesse, kampagne, optionen, politik, quantil } from './kern'
import type { Konto } from './kern'
import { ENDEN, endeVon } from './simulation'
import { erzeugePfad, stromAusPfad } from './stroeme'
import type { StromEingaben } from './stroeme'

export const RW = {
  /** 3: Raster für die Slider erweitert (13.10.2026): Trades pro Woche 1–20 in 9 Stufen, CRV 1–4 in 6 Stufen */
  version: 3,
  crv: [1, 1.5, 2, 2.5, 3, 4],
  /** Risiko je Trade als Anteil am Drawdown der jeweiligen Phase; höchstens 10 % (Petars Vorgabe, 12.10.2026) */
  risiko: [0.025, 0.05, 0.075, 0.1],
  /** Trefferquoten-Raster 10 % bis 80 % in 2,5-%-Schritten; darüber gilt ein Ziel als „kaum erreichbar“ */
  trefferquoten: Array.from({ length: 29 }, (_, i) => Math.round((0.1 + 0.025 * i) * 1000) / 1000),
  tradesProWoche: [1, 2, 3, 4, 5, 7, 10, 15, 20],
  monate: [1, 2, 3, 6, 12],
  /** „in X von 10 Fällen“ */
  sicherheit: [5, 7, 9],
  ziele: [500, 1000, 2000, 3000, 5000, 7500, 10000, 15000, 20000, 30000, 50000],
  pfade: 300,
  saat: 20261012,
  stopPunkte: 20,
  instrument: 'MNQ' as const,
} as const

export type RwKonto = { id: string; konto: Konto }

export function stromFuer(trefferquote: number, crv: number, tradesProWoche: number): StromEingaben {
  return {
    trefferquote, gewinnR: crv, verlustR: 1, tradesProWoche, streuung: 'gleich', stopPunkte: RW.stopPunkte,
    instrument: RW.instrument, nqKurs: 20000,
  }
}

/**
 * Netto-Stände nach jedem Zeitraum aus RW.monate für alle Pfade.
 * Rückgabe je Konto: Float64Array [risiko][monat][pfad]; null, wenn der Kontotyp nicht rechenbar ist (z. B. ohne Preis).
 */
export function nettoStaende(
  konten: RwKonto[], trefferquote: number, crv: number, tradesProWoche: number, pfade: number = RW.pfade, saat: number = RW.saat,
): (Float64Array | null)[] {
  const e = stromFuer(trefferquote, crv, tradesProWoche)
  const nR = RW.risiko.length
  const nM = RW.monate.length
  const out: (Float64Array | null)[] = konten.map((k) => (k.konto.preis === null ? null : new Float64Array(nR * nM * pfade)))
  const pol = politik({ name: 'A' })
  const grenzen = RW.monate.map((m) => m * MONAT)
  for (let i = 0; i < pfade; i++) {
    const pfad = erzeugePfad(e, saat, i)
    const futures = stromAusPfad(pfad, e, 'futures', 0)
    const perp = stromAusPfad(pfad, e, 'perp', 0)
    konten.forEach((k, ki) => {
      const ziel = out[ki]
      if (!ziel) return
      const st = k.konto.perp ? perp : futures
      const opt = optionen({ bot_betrieb: false, perp: k.konto.perp ? PERP_STANDARD : null })
      for (let r = 0; r < nR; r++) {
        let kmp
        try {
          kmp = kampagne(k.konto, st, 0, 365, groesse({ art: 'dd_anteil', wert: RW.risiko[r] }), opt, pol)
        } catch (err) {
          if (!(err instanceof NichtSimulierbar)) throw err
          out[ki] = null
          return
        }
        const t0 = st.uhr[0]
        let cum = 0
        let m = 0
        for (const [u, b] of kmp.fluss) {
          while (m < nM && u - t0 > grenzen[m] + 1e-9) {
            ziel[(r * nM + m) * pfade + i] = cum
            m++
          }
          cum += b
        }
        while (m < nM) {
          ziel[(r * nM + m) * pfade + i] = cum
          m++
        }
      }
    })
  }
  return out
}

/** Quantil-Stufe zu „in X von 10 Fällen erreicht“: Anteil der Fälle darunter. */
export const stufe = (sicherheit: number) => 1 - sicherheit / 10

/** Quantile [risiko][monat][sicherheit] aus den Netto-Ständen eines Kontotyps. */
export function quantile(staende: Float64Array, pfade: number = RW.pfade): Float64Array {
  const nR = RW.risiko.length
  const nM = RW.monate.length
  const nS = RW.sicherheit.length
  const q = new Float64Array(nR * nM * nS)
  for (let r = 0; r < nR; r++) {
    for (let m = 0; m < nM; m++) {
      const teil = Array.from(staende.subarray((r * nM + m) * pfade, (r * nM + m + 1) * pfade))
      RW.sicherheit.forEach((s, si) => {
        q[(r * nM + m) * nS + si] = quantil(teil, stufe(s)) as number
      })
    }
  }
  return q
}

/**
 * Nötige Trefferquote aus einer Kurve Netto-Quantil(Trefferquote) auf dem Raster RW.trefferquoten: kleinste Stelle,
 * ab der das Ziel durchgehend erreicht wird, linear eingepasst. null = auch bei 80 % nicht erreicht.
 */
export function noetigeTrefferquote(kurve: ArrayLike<number>, ziel: number): number | null {
  const p = RW.trefferquoten
  let k = p.length - 1
  if (!(kurve[k] >= ziel)) return null
  while (k > 0 && kurve[k - 1] >= ziel) k--
  if (k === 0) return p[0]
  const a = kurve[k - 1]
  const b = kurve[k]
  const t = b > a ? (ziel - a) / (b - a) : 1
  return p[k - 1] + Math.min(Math.max(t, 0), 1) * (p[k] - p[k - 1])
}

/**
 * Lösung für einen Kontotyp aus Quantilen je Trefferquote (Index wie RW.trefferquoten, Inhalt wie quantile()):
 * für jedes Ziel und jede Sicherheit die nötige Trefferquote mit dem dafür günstigsten Risiko.
 * Kodierung je Eintrag: -1 = kaum erreichbar, sonst Trefferquote in Promille * 4 + Index des Risikos.
 */
export function loese(qJeTrefferquote: Float64Array[], monatIndex: number): Int16Array {
  const nR = RW.risiko.length
  const nM = RW.monate.length
  const nS = RW.sicherheit.length
  const out = new Int16Array(nS * RW.ziele.length)
  for (let si = 0; si < nS; si++) {
    RW.ziele.forEach((z, zi) => {
      let best: number | null = null
      let bestR = 0
      for (let r = 0; r < nR; r++) {
        const kurve = qJeTrefferquote.map((q) => q[(r * nM + monatIndex) * nS + si])
        const p = noetigeTrefferquote(kurve, z)
        if (p !== null && (best === null || p < best - 1e-12)) {
          best = p
          bestR = r
        }
      }
      out[si * RW.ziele.length + zi] = best === null ? -1 : Math.round(best * 1000) * 4 + bestR
    })
  }
  return out
}

export type Anforderung = { trefferquote: number; risikoIndex: number } | null

export function dekodiere(v: number): Anforderung {
  if (v < 0) return null
  return { trefferquote: Math.floor(v / 4) / 1000, risikoIndex: v % 4 }
}

/** Erwartung je Trade in R bei Trefferquote p und CRV c (Verlierer −1 R, Gewinner +c R). */
export const erwartungBeiCrv = (p: number, crv: number) => p * crv - (1 - p)

/**
 * Tabelle je (Trades pro Woche, Zeitraum): Kontotypen, Raster und Werte [konto][crv][sicherheit][ziel] (kodiert, siehe loese).
 * Ein Ziel zwischen zwei Rasterwerten wird auf der Trefferquote linear eingepasst; ist eine Seite „kaum erreichbar“,
 * zählt die ungünstigere.
 */
export type RwTabelle = {
  version: number
  stand: string
  tradesProWoche: number
  monate: number
  pfade: number
  crv: number[]
  risiko: number[]
  sicherheit: number[]
  ziele: number[]
  konten: string[]
  werte: number[]
}

export function anforderungAusTabelle(t: RwTabelle, kontoIndex: number, crvIndex: number, sicherheitIndex: number, ziel: number): Anforderung {
  const nZ = t.ziele.length
  const basis = ((kontoIndex * t.crv.length + crvIndex) * t.sicherheit.length + sicherheitIndex) * nZ
  const wert = (zi: number) => dekodiere(t.werte[basis + zi])
  if (ziel <= t.ziele[0]) return wert(0)
  if (ziel >= t.ziele[nZ - 1]) return ziel === t.ziele[nZ - 1] ? wert(nZ - 1) : null
  let zi = 1
  while (t.ziele[zi] < ziel) zi++
  const a = wert(zi - 1)
  const b = wert(zi)
  if (!b) return null
  if (!a) return b
  const w = (Math.log(ziel) - Math.log(t.ziele[zi - 1])) / (Math.log(t.ziele[zi]) - Math.log(t.ziele[zi - 1]))
  return {
    trefferquote: a.trefferquote + w * (b.trefferquote - a.trefferquote),
    risikoIndex: w < 0.5 ? a.risikoIndex : b.risikoIndex,
  }
}

export type RwDetail = {
  /** Anteil der Fälle mit mindestens dem Ziel nach dem Zeitraum */
  erreicht: number
  /** mittlerer Netto-Stand nach dem Zeitraum (Median) */
  median: number
  /** dasselbe ohne Vorteil: Trefferquote 1 / (1 + CRV), also Erwartung 0 */
  medianOhneVorteil: number
  endenEval: number[]
  endenFunded: number[]
  consHebt: number
  consSperre: number
}

/**
 * Details zu einer Anforderung (Karte antippen): Live-Rechnung für einen Kontotyp mit der gefundenen Trefferquote,
 * gleiche Zufallszahlen wie die Tabelle. Woran der erste Kauf scheitert (12 Monate) und der Vergleich mit Erwartung 0.
 */
export function detailRueckwaerts(
  konto: Konto, trefferquote: number, crv: number, tradesProWoche: number, risikoIndex: number, monate: number, ziel: number,
  pfade: number = RW.pfade, saat: number = RW.saat,
): RwDetail {
  const g = groesse({ art: 'dd_anteil', wert: RW.risiko[risikoIndex] })
  const opt = optionen({ bot_betrieb: false, perp: konto.perp ? PERP_STANDARD : null })
  const pol = politik({ name: 'A' })
  const grenze = monate * MONAT
  const lauf = (p: number) => {
    const e = stromFuer(p, crv, tradesProWoche)
    const netto: number[] = []
    const ende: number[] = []
    const endeFunded: number[] = []
    let consHebt = 0
    let consSperre = 0
    for (let i = 0; i < pfade; i++) {
      const pfad = erzeugePfad(e, saat, i)
      const st = stromAusPfad(pfad, e, konto.perp ? 'perp' : 'futures', 0)
      const k = kampagne(konto, st, 0, 365, g, opt, pol)
      let cum = 0
      for (const [u, b] of k.fluss) {
        if (u - st.uhr[0] > grenze + 1e-9) break
        cum += b
      }
      netto.push(cum)
      const v = k.erster
      ende.push(ENDEN.indexOf(endeVon(v)))
      endeFunded.push(v.status === 'bruch' ? (v.bruch_phase === 'eval' ? 0 : 1) : v.end_phase === 'eval' ? 0 : 1)
      if (v.cons_hebt) consHebt++
      if (v.cons_ausz_sperren > 0) consSperre++
    }
    return { netto, ende, endeFunded, consHebt: consHebt / pfade, consSperre: consSperre / pfade }
  }
  const mit = lauf(trefferquote)
  const ohne = lauf(1 / (1 + crv))
  const anteil = (j: number, f: number) => mit.ende.filter((x, i) => x === j && mit.endeFunded[i] === f).length / pfade
  return {
    erreicht: mit.netto.filter((x) => x >= ziel).length / pfade,
    median: quantil(mit.netto, 0.5) as number,
    medianOhneVorteil: quantil(ohne.netto, 0.5) as number,
    endenEval: ENDEN.map((_, j) => anteil(j, 0)),
    endenFunded: ENDEN.map((_, j) => anteil(j, 1)),
    consHebt: mit.consHebt,
    consSperre: mit.consSperre,
  }
}
