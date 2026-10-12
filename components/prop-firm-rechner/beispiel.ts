/**
 * Beispiel-Ergebnis für die Karte im Hero: der Rechner meldet hier das Ergebnis seiner ersten Rechnung mit den Startwerten.
 * Kleiner Modul-Speicher statt Kontext, weil Hero und Rechner getrennte Inseln sind. Nichts wird doppelt gerechnet.
 */
import { useSyncExternalStore } from 'react'

export type BeispielWert = {
  firma: string
  groesse: number
  programm: string
  variante: string
  /** Netto pro Monat des besten Kontotyps (vorsichtige Lesart, wie die Rangfolge) */
  netto: number
  /** Netto pro Monat des besten Kontotyps ohne Kante (Kante 0) */
  ohneKante: number
}
export type BeispielZustand = { status: 'rechnet' } | { status: 'fertig'; wert: BeispielWert } | { status: 'abgebrochen' }

const RECHNET: BeispielZustand = { status: 'rechnet' }
let zustand: BeispielZustand = RECHNET
const hoerer = new Set<() => void>()

export function setzeBeispiel(neu: BeispielZustand) {
  zustand = neu
  hoerer.forEach((h) => h())
}

export function beispielStatus(): BeispielZustand['status'] {
  return zustand.status
}

function abonniere(h: () => void) {
  hoerer.add(h)
  return () => {
    hoerer.delete(h)
  }
}

export function useBeispiel(): BeispielZustand {
  return useSyncExternalStore(abonniere, () => zustand, () => RECHNET)
}
