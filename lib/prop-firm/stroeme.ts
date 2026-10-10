/**
 * Prop-Firm-Rechner: Monte-Carlo-Trade-Ströme aus einfachen Eingaben.
 *
 * Ein Pfad = ein Jahr Handelstage (Montag bis Freitag) mit zufällig verteilten Trades. Jeder Trade gewinnt mit der
 * Trefferquote, Gewinner streuen um den Durchschnittsgewinn (Form wählbar), Verlierer verlieren den Durchschnitts-
 * verlust. Zu jedem Pfad gehört ein Zwilling mit Kante 0: dieselben Trades, jedes Ergebnis um die Erwartung je Trade
 * verschoben (gleiche Form und Streuung, Netto-Erwartung 0, wie die zentrierte Null der Referenz).
 */
import type { Strom, Trade } from './kern'

export type Streuung = 'gleich' | 'gemischt' | 'wenige_grosse'

export type StromEingaben = {
  trefferquote: number // 0 bis 1
  gewinnR: number // Durchschnittsgewinn in R (netto)
  verlustR: number // Durchschnittsverlust in R (netto, positiv)
  tradesProWoche: number
  streuung: Streuung
  stopPunkte: number // Stopp in NQ-Punkten
  instrument: 'MNQ' | 'NQ'
  nqKurs: number // Kursniveau für Perp-Hebel und Perp-Kosten
}

export const STREUUNG_SIGMA: Record<Streuung, number> = { gleich: 0, gemischt: 0.6, wenige_grosse: 1.1 }
export const PUNKTWERT = { MNQ: 2, NQ: 20 } as const
export const START_DATUM = Date.UTC(2027, 0, 4) // Montag; Feiertage bleiben unberücksichtigt
export const TAGE_IM_PFAD = 380 // Kalendertage; ein Kauf und eine Kampagne laufen 365 Tage
export const MAX_TRADES_TAG = 12

/** Erwartung je Trade in R (netto). */
export function erwartungR(e: Pick<StromEingaben, 'trefferquote' | 'gewinnR' | 'verlustR'>): number {
  return e.trefferquote * e.gewinnR - (1 - e.trefferquote) * e.verlustR
}

/** Streuung (Standardabweichung) eines Trades in R. */
export function streuungR(e: Pick<StromEingaben, 'trefferquote' | 'gewinnR' | 'verlustR' | 'streuung'>): number {
  const p = e.trefferquote
  const s = STREUUNG_SIGMA[e.streuung]
  const zweitesMomentGewinn = e.gewinnR * e.gewinnR * Math.exp(s * s)
  const m2 = p * zweitesMomentGewinn + (1 - p) * e.verlustR * e.verlustR
  const mu = erwartungR(e)
  return Math.sqrt(Math.max(m2 - mu * mu, 0))
}

// ------------------------------------------------------------------------------------------------- Zufall
/** Kleiner, schneller Zufallsgenerator (sfc32) mit splitmix32-Saat: gleiche Saat, gleicher Pfad. */
export function zufall(saat: number, pfad: number): () => number {
  let h = (saat ^ Math.imul(pfad + 0x9e3779b9, 0x85ebca6b)) >>> 0
  const mix = () => {
    h = (h + 0x9e3779b9) >>> 0
    let z = h
    z = Math.imul(z ^ (z >>> 16), 0x21f0aaad)
    z = Math.imul(z ^ (z >>> 15), 0x735a2d97)
    return (z ^ (z >>> 15)) >>> 0
  }
  let a = mix()
  let b = mix()
  let c = mix()
  let d = mix()
  const next = () => {
    const t = (((a + b) >>> 0) + d) >>> 0
    d = (d + 1) >>> 0
    a = b ^ (b >>> 9)
    b = (c + (c << 3)) >>> 0
    c = (c << 21) | (c >>> 11)
    c = (c + t) >>> 0
    return t / 4294967296
  }
  for (let i = 0; i < 12; i++) next()
  return next
}

function normal(r: () => number): number {
  let u = 0
  while (u === 0) u = r()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r())
}

function poisson(r: () => number, lambda: number): number {
  const L = Math.exp(-lambda)
  let k = 0
  let p = 1
  do {
    k += 1
    p *= r()
  } while (p > L && k < 100)
  return k - 1
}

/** ISO-Woche als Jahr * 100 + Woche (Kalenderwochen-Regeln der Firmen). */
export function isoWoche(ms: number): number {
  const d = new Date(ms)
  const tag = d.getUTCDay() || 7 // Montag = 1 ... Sonntag = 7
  const donnerstag = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 4 - tag)
  const jahr = new Date(donnerstag).getUTCFullYear()
  const woche = Math.ceil(((donnerstag - Date.UTC(jahr, 0, 1)) / 864e5 + 1) / 7)
  return jahr * 100 + woche
}

// ------------------------------------------------------------------------------------------------- Pfade
/** Ergebnis eines Trades in R mit Gegen- und Gunstbewegung (MAE/MFE) in R. */
type RohTrade = { tag: number; ein: number; aus: number; r: number; mae: number; mfe: number; stop: boolean }

export type Pfad = {
  uhr: number[]
  woche: number[]
  roh: RohTrade[][]
}

/**
 * Ein Pfad: Kalender, Trades je Tag (Poisson um Trades pro Woche / 5), Ergebnisse in R.
 * MAE/MFE (Annahmen, auf der Seite erklärt): Verlierer laufen bis zum Stopp (MAE = Verlust) und lagen vorher bis
 * 0,5 R im Plus; Gewinner lagen vorher bis 0,6 R im Minus und zwischendurch bis 25 % über dem Endergebnis.
 */
export function erzeugePfad(e: StromEingaben, saat: number, pfad: number): Pfad {
  const r = zufall(saat, pfad)
  const lambda = Math.max(e.tradesProWoche, 0) / 5
  const sigma = STREUUNG_SIGMA[e.streuung]
  const uhr: number[] = []
  const woche: number[] = []
  const roh: RohTrade[][] = []
  for (let k = 0; k <= TAGE_IM_PFAD; k++) {
    const ms = START_DATUM + k * 864e5
    const wtag = new Date(ms).getUTCDay()
    if (wtag === 0 || wtag === 6) continue
    uhr.push(ms / 864e5)
    woche.push(isoWoche(ms))
    const anzahl = Math.min(poisson(r, lambda), MAX_TRADES_TAG)
    const liste: RohTrade[] = []
    for (let j = 0; j < anzahl; j++) {
      const gewinn = r() < e.trefferquote
      const z = normal(r)
      const u1 = r()
      const u2 = r()
      const ein = 930 + 30 * j // 09:30 ET + 30 Minuten je weiterem Trade (Minuten ab 18:00 ET)
      if (gewinn) {
        const g = sigma > 0 ? e.gewinnR * Math.exp(sigma * z - (sigma * sigma) / 2) : e.gewinnR
        liste.push({ tag: uhr.length - 1, ein, aus: ein + 20, r: g, mae: 0.6 * u1, mfe: g * (1 + 0.25 * u2), stop: false })
      } else {
        liste.push({ tag: uhr.length - 1, ein, aus: ein + 20, r: -e.verlustR, mae: e.verlustR, mfe: 0.5 * u2, stop: true })
      }
    }
    roh.push(liste)
  }
  return { uhr, woche, roh }
}

/**
 * Strom aus einem Pfad. art 'futures': Kontrakt-Modus (USD je Kontrakt, ganze Kontrakte); 'perp': R-Modus
 * (1 Einheit = 1 USD Risiko, stufenlos). verschiebungR = Erwartung, die abgezogen wird (Kante 0) oder 0.
 */
export function stromAusPfad(p: Pfad, e: StromEingaben, art: 'futures' | 'perp', verschiebungR: number): Strom {
  const pv = PUNKTWERT[e.instrument]
  const stopE = e.stopPunkte * pv
  const tage: Trade[][] = p.roh.map((liste) =>
    liste.map((t) => {
      const r = t.r - verschiebungR
      const mfe = Math.max(t.mfe, r, 0)
      if (art === 'futures') {
        return {
          ein: t.ein, aus: t.aus, pnl_e: r * stopE, risiko_e: stopE, stop_e: stopE, mae_e: t.mae * stopE, mfe_e: mfe * stopE,
          ist_stop: t.stop, kurs: e.nqKurs, stop_pt: e.stopPunkte, punktwert_e: pv, stunden: (t.aus - t.ein) / 60,
        }
      }
      return {
        ein: t.ein, aus: t.aus, pnl_e: r, risiko_e: 1, stop_e: 1, mae_e: t.mae, mfe_e: mfe, ist_stop: t.stop, kurs: e.nqKurs,
        stop_pt: e.stopPunkte, punktwert_e: 1 / e.stopPunkte, stunden: (t.aus - t.ein) / 60,
      }
    }),
  )
  return {
    modus: art === 'futures' ? 'kontrakt' : 'r',
    instrument: art === 'futures' ? (e.instrument === 'MNQ' ? 'micro' : 'mini') : 'perp',
    uhr: p.uhr,
    woche: p.woche,
    tage,
  }
}
