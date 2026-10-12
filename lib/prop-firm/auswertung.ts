/**
 * Prop-Firm-Rechner: Kennzahlen aus den Monte-Carlo-Pfaden, Rangfolge und Glücksvergleich.
 */
import { EPS, MONAT, quantil } from './kern'
import type { KontoEintrag } from './konten'
import { ENDEN, M, N_METRIKEN } from './simulation'
import type { RohErgebnis } from './simulation'
import { erwartungR, streuungR } from './stroeme'
import type { StromEingaben } from './stroeme'

export type Verteilung = { mittel: number; se: number; p10: number; p50: number; p90: number; positiv: number }

export type Kennzahlen = {
  n: number
  fk30: number | null // null = Kontotyp ohne Prüfung
  fk60: number | null
  fk90: number | null
  bestanden12: number | null
  passMedianHT: number | null
  ausz6: number
  ausz12: number
  auszMedianHT: number | null
  bruch12: number
  bruchEval12: number
  netto: Verteilung | null // null = Preis unbekannt
  gebuehren: number | null
  ertrag: number | null
  auszahlungen: number | null
  kaeufe: number | null
  einsatzP90: number | null
  kAusz6: number | null
  /** Anteile der Käufe je Ende (Reihenfolge wie ENDEN), getrennt nach Prüfung und Funded-Teil */
  endenEval: number[]
  endenFunded: number[]
  consHebt: number
  consSperre: number
}

function spalte(arr: Float64Array, m: number): number[] {
  const n = arr.length / N_METRIKEN
  const out = new Array<number>(n)
  for (let i = 0; i < n; i++) out[i] = arr[i * N_METRIKEN + m]
  return out
}

const anteil = (x: number[], f: (v: number) => boolean) => (x.length ? x.filter(f).length / x.length : 0)
const mittel = (x: number[]) => (x.length ? x.reduce((a, b) => a + b, 0) / x.length : NaN)
const endlich = (x: number[]) => x.filter((v) => Number.isFinite(v))

export function kennzahlen(arr: Float64Array, hatEval: boolean): Kennzahlen {
  const n = arr.length / N_METRIKEN
  const pass = spalte(arr, M.passHT)
  const auszTage = spalte(arr, M.auszTage)
  const netto = spalte(arr, M.netto)
  const nettoOk = endlich(netto)
  let vert: Verteilung | null = null
  if (nettoOk.length === n && n > 0) {
    const mu = mittel(nettoOk)
    const sd = Math.sqrt(nettoOk.reduce((a, b) => a + (b - mu) * (b - mu), 0) / Math.max(n - 1, 1))
    vert = {
      mittel: mu, se: sd / Math.sqrt(n), p10: quantil(nettoOk, 0.1) as number, p50: quantil(nettoOk, 0.5) as number,
      p90: quantil(nettoOk, 0.9) as number, positiv: anteil(nettoOk, (v) => v > 0),
    }
  }
  const mit = (m: number) => (vert ? mittel(spalte(arr, m)) : null)
  const kAusz = spalte(arr, M.kAuszTage)
  const ende = spalte(arr, M.ende)
  const endeFunded = spalte(arr, M.endeFunded)
  const endenEval = ENDEN.map((_, j) => (n ? ende.filter((v, i) => v === j && endeFunded[i] === 0).length / n : 0))
  const endenFunded = ENDEN.map((_, j) => (n ? ende.filter((v, i) => v === j && endeFunded[i] === 1).length / n : 0))
  return {
    n,
    fk30: hatEval ? anteil(pass, (v) => v <= 30) : null,
    fk60: hatEval ? anteil(pass, (v) => v <= 60) : null,
    fk90: hatEval ? anteil(pass, (v) => v <= 90) : null,
    bestanden12: hatEval ? anteil(pass, (v) => Number.isFinite(v)) : null,
    passMedianHT: hatEval ? quantil(endlich(pass), 0.5) : null,
    ausz6: anteil(auszTage, (v) => v <= 6 * MONAT + EPS),
    ausz12: anteil(auszTage, (v) => Number.isFinite(v)),
    auszMedianHT: quantil(endlich(spalte(arr, M.auszHT)), 0.5),
    bruch12: anteil(spalte(arr, M.bruch), (v) => v === 1),
    bruchEval12: anteil(spalte(arr, M.bruchEval), (v) => v === 1),
    netto: vert,
    gebuehren: mit(M.gebuehren),
    ertrag: mit(M.ertrag),
    auszahlungen: mit(M.auszahlungen),
    kaeufe: mit(M.kaeufe),
    einsatzP90: vert ? quantil(spalte(arr, M.einsatz), 0.9) : null,
    kAusz6: vert ? anteil(kAusz, (v) => v <= 6 * MONAT + EPS) : null,
    endenEval,
    endenFunded,
    consHebt: anteil(spalte(arr, M.consHebt), (v) => v === 1),
    consSperre: anteil(spalte(arr, M.consSperre), (v) => v === 1),
  }
}

/** Ergebnisse mehrerer Worker (je ein Pfad-Bereich) aneinanderhängen, in Pfad-Reihenfolge. */
export function verbinde(teile: Record<string, RohErgebnis>[]): Record<string, RohErgebnis> {
  const out: Record<string, RohErgebnis> = {}
  for (const schl of Object.keys(teile[0] || {})) {
    const stuecke = teile.map((t) => t[schl])
    const laenge = stuecke.reduce((a, s) => a + s.kante.length, 0)
    const kante = new Float64Array(laenge)
    const nul = new Float64Array(laenge)
    let o = 0
    for (const s of stuecke) {
      kante.set(s.kante, o)
      nul.set(s.null, o)
      o += s.kante.length
    }
    out[schl] = { politik: stuecke[0].politik, kante, null: nul, grund: stuecke.find((s) => s.grund)?.grund ?? null }
  }
  return out
}

export type VariantenErgebnis = { name: string; text: string; kante: Kennzahlen; null: Kennzahlen }

export type Zeile = {
  eintrag: KontoEintrag
  politik: 'A' | 'B' | 'C'
  kante: Kennzahlen
  null: Kennzahlen
  varianten: VariantenErgebnis[]
  rangNetto: number | null // ungünstigster Netto-Mittelwert über Standard und offene Varianten
  rangNull: number | null // dasselbe mit Kante 0
  rangVariante: string | null // Text der Variante, die den Rang bestimmt (null = Standard)
  grund: string | null
  inRangfolge: boolean
}

export const schluesselFuer = (id: string, rechnung: string) => `${id}|${rechnung}`

export function baueZeilen(eintraege: KontoEintrag[], roh: Record<string, RohErgebnis>, botBetrieb: boolean): Zeile[] {
  const zeilen: Zeile[] = []
  for (const e of eintraege) {
    const std = roh[schluesselFuer(e.id, 'standard')]
    if (!std) continue
    const kante = kennzahlen(std.kante, e.hatEval)
    const nul = kennzahlen(std.null, e.hatEval)
    const varianten: VariantenErgebnis[] = []
    for (const r of e.rechnungen.slice(1)) {
      const v = roh[schluesselFuer(e.id, r.name)]
      if (!v || v.grund) continue
      varianten.push({ name: r.name, text: r.text ?? r.name, kante: kennzahlen(v.kante, e.hatEval), null: kennzahlen(v.null, e.hatEval) })
    }
    let rangNetto = kante.netto ? kante.netto.mittel : null
    let rangNull = nul.netto ? nul.netto.mittel : null
    let rangVariante: string | null = null
    for (const v of varianten) {
      if (rangNetto !== null && v.kante.netto && v.kante.netto.mittel < rangNetto) {
        rangNetto = v.kante.netto.mittel
        rangVariante = v.text
      }
      if (rangNull !== null && v.null.netto && v.null.netto.mittel < rangNull) rangNull = v.null.netto.mittel
    }
    const grund = std.grund
    zeilen.push({
      eintrag: e, politik: std.politik, kante, null: nul, varianten, rangNetto: grund ? null : rangNetto,
      rangNull: grund ? null : rangNull, rangVariante, grund,
      inRangfolge: !grund && e.aktiv && rangNetto !== null && !(botBetrieb && e.botAusschluss),
    })
  }
  return zeilen
}

export type Gluecksvergleich = {
  n: number
  bestKante: number | null
  bestKanteZeile: Zeile | null
  bestNull: number | null
  bestNullZeile: Zeile | null
  mittelNull: number | null
  anteilNullPositiv: number
  mittelKante: number | null
}

/** „So sähe es mit reinem Glück aus“: dieselbe Auswahl über alle Kontotypen, aber mit Kante 0. */
export function gluecksvergleich(zeilen: Zeile[]): Gluecksvergleich {
  const r = zeilen.filter((z) => z.inRangfolge && z.rangNull !== null && z.rangNetto !== null)
  let bestK: Zeile | null = null
  let bestN: Zeile | null = null
  for (const z of r) {
    if (!bestK || (z.rangNetto as number) > (bestK.rangNetto as number)) bestK = z
    if (!bestN || (z.rangNull as number) > (bestN.rangNull as number)) bestN = z
  }
  return {
    n: r.length,
    bestKante: bestK ? bestK.rangNetto : null,
    bestKanteZeile: bestK,
    bestNull: bestN ? bestN.rangNull : null,
    bestNullZeile: bestN,
    mittelNull: r.length ? mittel(r.map((z) => z.rangNull as number)) : null,
    anteilNullPositiv: anteil(r.map((z) => z.rangNull as number), (v) => v > 0),
    mittelKante: r.length ? mittel(r.map((z) => z.rangNetto as number)) : null,
  }
}

/** Wie sicher ist die Kante selbst? Erwartung, Streuung je Trade und nötige Trades für ein 95-%-Signal. */
export function kantenSicherheit(e: StromEingaben) {
  const erwartung = erwartungR(e)
  const sd = streuungR(e)
  const tradesNoetig = erwartung > 0 ? Math.ceil(((1.96 * sd) / erwartung) ** 2) : null
  return { erwartung, sd, tradesNoetig, band100: (1.96 * sd) / 10 }
}
