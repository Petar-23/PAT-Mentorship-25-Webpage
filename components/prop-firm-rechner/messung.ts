import { track } from '@vercel/analytics'
import { trackEvent } from '@/components/analytics/tracking'
import type { CookieConsent } from '@/lib/cookie-consent'
import { readCookieConsent } from '@/lib/cookie-consent-client'
import type { Sprache } from './texte'

/**
 * Drei Ereignisse des Rechners, ohne personenbezogene Daten: keine Eingaben, keine Ergebnisse, keine Kennungen.
 * Nur die Sprache der Seite und, je Ereignis, der Modus bzw. das Ziel des Klicks.
 */
export type RechnerEreignis =
  | { name: 'rechner_start' }
  | { name: 'rechner_ergebnis'; modus: 'rueckwaerts' | 'vorwaerts' }
  | { name: 'rechner_cta'; ziel: 'x' | 'youtube' | 'substack' | 'etoro' }

export type Sender = (name: string, daten: Record<string, string>) => void

/** Gesendet wird nur mit Einwilligung in „Analyse“. Ohne Entscheidung oder nach Ablehnen: nichts. */
export function darfMessen(einwilligung: CookieConsent | null | undefined): boolean {
  return einwilligung?.analytics === true
}

/** Kern zum Prüfen: Einwilligung und Empfänger von außen. Liefert, ob gesendet wurde. */
export function messeMit(einwilligung: CookieConsent | null | undefined, sender: Sender[], sprache: Sprache, e: RechnerEreignis): boolean {
  if (!darfMessen(einwilligung)) return false
  const { name, ...rest } = e
  const daten: Record<string, string> = { ...rest, sprache }
  for (const senden of sender) {
    try {
      senden(name, daten)
    } catch {
      // Messen darf den Rechner nie stören.
    }
  }
  return true
}

/**
 * Vercel Web Analytics (track) und der bestehende Google-Tag (trackEvent, sendet selbst nur mit Einwilligung).
 * Beide hängen an der Einwilligung aus dem Cookie-Banner; Vercel zählt Custom Events nur auf Pro/Enterprise.
 */
const SENDER: Sender[] = [(name, daten) => track(name, daten), (name, daten) => trackEvent(name, daten)]

export function messe(sprache: Sprache, e: RechnerEreignis): boolean {
  if (typeof window === 'undefined') return false
  return messeMit(readCookieConsent(), SENDER, sprache, e)
}
