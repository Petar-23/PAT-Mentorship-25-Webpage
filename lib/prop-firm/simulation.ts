/**
 * Prop-Firm-Rechner: Monte-Carlo-Lauf. Je Pfad ein Strom mit Kante und sein Zwilling mit Kante 0; jeder Kontotyp
 * (und jede offene Variante) rechnet auf beiden einen Konto-Platz über 12 Monate. Der erste Kauf der Kampagne ist
 * zugleich der Einzelkauf (Chance zu bestehen, erste Auszahlung, gesprengt).
 */
import {
  MONAT, NichtSimulierbar, PERP_STANDARD, groesse, kampagne, optionen, politik, politikFuer, pruefeStrom,
  searchsortedRechts, versuch,
} from './kern'
import type { Groesse, Konto, Optionen, Politik, Strom, VersuchErgebnis } from './kern'
import { PUNKTWERT, erwartungR, erzeugePfad, stromAusPfad } from './stroeme'
import type { StromEingaben } from './stroeme'

export const HORIZONT_TAGE = 365

export type GroessenModus = 'risiko' | 'kontrakte' | 'dd_anteil'

export type SimEinstellungen = {
  strom: StromEingaben
  groessenModus: GroessenModus
  risikoUsd: number
  kontrakte: number
  ddAnteil: number // 0 bis 1
  politik: 'A' | 'B' | 'C'
  politikFaktor: number // Polster in Vielfachen des Funded-Drawdowns
  botBetrieb: boolean
  perpKosten: boolean
  saat: number
}

/** Kennzahlen je Pfad (Reihenfolge der Spalten im Ergebnis-Array). */
export const METRIKEN = [
  'passHT', // Handelstage bis Bestehen (0 = ohne Prüfung), NaN = nicht bestanden
  'auszHT', // Handelstage bis zur ersten Auszahlung (ein Kauf), NaN = keine
  'auszTage', // Kalendertage bis zur ersten Auszahlung (ein Kauf)
  'bruch', // 1 = Konto gesprengt (ein Kauf, 12 Monate)
  'bruchEval', // 1 = in der Prüfung gesprengt
  'netto', // Netto je Monat der Kampagne (alle Gebühren, Auszahlungen nach Split)
  'gebuehren', // Gebühren je Monat
  'ertrag', // Auszahlungen netto je Monat
  'auszahlungen', // Anzahl Auszahlungen in der Kampagne
  'kaeufe', // Käufe in der Kampagne
  'kAuszTage', // Kalendertage bis zur ersten Auszahlung in der Kampagne (mit Nachkauf)
  'einsatz', // größter Kapitaleinsatz (Gebühren vor der ersten Rückzahlung)
  'ende', // ein Kauf, 12 Monate: Index in ENDEN (woran er endet bzw. wo er steht)
  'endeFunded', // 1 = Ende im Funded- bzw. Live-Teil, 0 = in der Prüfung
  'consHebt', // 1 = Consistency hat das Prüfungsziel angehoben
  'consSperre', // 1 = Consistency hat mindestens eine Auszahlung aufgeschoben
] as const

/**
 * Wie ein Kauf nach 12 Monaten steht: an welcher Regel er gescheitert ist (dd, dll, zeitlimit, inaktivitaet; Codes aus
 * kern.versuch) oder dass er noch in der Prüfung ist, im Funded-Konto läuft oder regulär weiterging (Live-Konto,
 * Auszahlungs-Höchstzahl erreicht, bestanden ohne Funded-Teil).
 */
export const ENDEN = ['dd', 'dll', 'zeitlimit', 'inaktivitaet', 'offen_eval', 'funded_laeuft', 'weiter'] as const
export type Ende = (typeof ENDEN)[number]

export function endeVon(v: VersuchErgebnis): Ende {
  if (v.status === 'bruch') return (ENDEN as readonly string[]).includes(v.grund ?? '') ? (v.grund as Ende) : 'dd'
  if (v.status === 'offen') return v.end_phase === 'eval' ? 'offen_eval' : 'funded_laeuft'
  return 'weiter'
}
export const M = Object.fromEntries(METRIKEN.map((m, i) => [m, i])) as Record<(typeof METRIKEN)[number], number>
export const N_METRIKEN = METRIKEN.length

export type Auftrag = { schluessel: string; konto: Konto }

export type RohErgebnis = {
  politik: 'A' | 'B' | 'C'
  kante: Float64Array // Pfade x Metriken
  null: Float64Array
  grund: string | null // nicht rechenbar
}

export function groesseFuer(konto: Konto, e: SimEinstellungen): Groesse {
  if (e.groessenModus === 'dd_anteil') return groesse({ art: 'dd_anteil', wert: e.ddAnteil })
  if (e.groessenModus === 'kontrakte') {
    if (!konto.perp) return groesse({ art: 'kontrakte', wert: e.kontrakte })
    return groesse({ art: 'risiko_usd', wert: e.kontrakte * e.strom.stopPunkte * PUNKTWERT[e.strom.instrument] })
  }
  return groesse({ art: 'risiko_usd', wert: e.risikoUsd })
}

export function optionenFuer(konto: Konto, e: SimEinstellungen): Optionen {
  return optionen({ bot_betrieb: e.botBetrieb, perp: konto.perp && e.perpKosten ? PERP_STANDARD : null })
}

export function politikFuerEinstellung(konto: Konto, e: SimEinstellungen): Politik {
  return politikFuer(konto, e.politik, e.politikFaktor) ?? politik({ name: 'A' })
}

function schreibe(ziel: Float64Array, zeile: number, konto: Konto, strom: Strom, v: VersuchErgebnis, k: ReturnType<typeof kampagne> | null) {
  const o = zeile * N_METRIKEN
  const a0 = v.auszahlungen.length ? v.auszahlungen[0] : null
  ziel[o + M.passHT] = konto.phasen[0].typ !== 'eval' ? 0 : v.pass_i !== null ? v.pass_i - v.start + 1 : NaN
  ziel[o + M.auszHT] = a0 ? a0.i - v.start + 1 : NaN
  ziel[o + M.auszTage] = a0 ? strom.uhr[a0.i] - strom.uhr[v.start] : NaN
  ziel[o + M.bruch] = v.status === 'bruch' ? 1 : 0
  ziel[o + M.bruchEval] = v.status === 'bruch' && v.bruch_phase === 'eval' ? 1 : 0
  ziel[o + M.netto] = k ? k.netto / k.monate : NaN
  ziel[o + M.gebuehren] = k ? k.gebuehren / k.monate : NaN
  ziel[o + M.ertrag] = k ? k.ertrag / k.monate : NaN
  ziel[o + M.auszahlungen] = k ? k.n_auszahlungen : NaN
  ziel[o + M.kaeufe] = k ? k.n_kauf : NaN
  ziel[o + M.kAuszTage] = k && k.erste_ausz_tage !== null ? k.erste_ausz_tage : NaN
  ziel[o + M.einsatz] = k ? k.einsatz : NaN
  ziel[o + M.ende] = ENDEN.indexOf(endeVon(v))
  ziel[o + M.endeFunded] = v.status === 'bruch' ? (v.bruch_phase === 'eval' ? 0 : 1) : v.end_phase === 'eval' ? 0 : 1
  ziel[o + M.consHebt] = v.cons_hebt ? 1 : 0
  ziel[o + M.consSperre] = v.cons_ausz_sperren > 0 ? 1 : 0
}

/**
 * Rechnet die Pfade [von, bis) für alle Aufträge. Rückgabe je Schlüssel: Kennzahlen-Arrays mit Kante und Kante 0.
 * fortschritt(fertigePfade) wird nach jedem Pfad gerufen.
 */
export function simuliere(
  auftraege: Auftrag[], e: SimEinstellungen, von: number, bis: number, fortschritt?: (fertig: number) => void,
): Record<string, RohErgebnis> {
  const nPfade = Math.max(bis - von, 0)
  const erw = erwartungR(e.strom)
  const out: Record<string, RohErgebnis> = {}
  const vorbereitet = auftraege.map((a) => {
    const g = groesseFuer(a.konto, e)
    const o = optionenFuer(a.konto, e)
    const p = politikFuerEinstellung(a.konto, e)
    out[a.schluessel] = {
      politik: p.name as 'A' | 'B' | 'C',
      kante: new Float64Array(nPfade * N_METRIKEN).fill(NaN),
      null: new Float64Array(nPfade * N_METRIKEN).fill(NaN),
      grund: null,
    }
    return { ...a, g, o, p }
  })
  for (let i = von; i < bis; i++) {
    const pfad = erzeugePfad(e.strom, e.saat, i)
    const cache: Record<string, Strom> = {}
    const strom = (art: 'futures' | 'perp', nullKante: boolean) => {
      const schl = `${art}${nullKante ? '0' : '1'}`
      if (!cache[schl]) cache[schl] = stromAusPfad(pfad, e.strom, art, nullKante ? erw : 0)
      return cache[schl]
    }
    for (const a of vorbereitet) {
      const r = out[a.schluessel]
      if (r.grund) continue
      for (const nullKante of [false, true]) {
        const st = strom(a.konto.perp ? 'perp' : 'futures', nullKante)
        try {
          if (i === von) pruefeStrom(a.konto, st, a.o)
          let k: ReturnType<typeof kampagne> | null = null
          let v: VersuchErgebnis
          if (a.konto.preis !== null) {
            k = kampagne(a.konto, st, 0, HORIZONT_TAGE, a.g, a.o, a.p)
            v = k.erster
          } else {
            const ende = searchsortedRechts(st.uhr, st.uhr[0] + HORIZONT_TAGE) - 1
            v = versuch(a.konto, st, 0, ende, a.g, a.o, a.p)
          }
          schreibe(nullKante ? r.null : r.kante, i - von, a.konto, st, v, k)
        } catch (err) {
          if (!(err instanceof NichtSimulierbar)) throw err
          r.grund = err.message
          break
        }
      }
    }
    fortschritt?.(i - von + 1)
  }
  return out
}

export const SECHS_MONATE_TAGE = 6 * MONAT
