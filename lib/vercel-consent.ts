import { readCookieConsent } from '@/lib/cookie-consent-client'

/** Auch bereits geladene Skripte prüfen vor jedem Versand die aktuelle Einwilligung. */
export function beforeVercelSend<T extends { url: string }>(event: T): T | null {
  if (readCookieConsent()?.analytics !== true) return null

  try {
    // Checkout-Parameter, Suchwerte und Fragmente gehören nicht in die Analyse.
    const url = new URL(event.url)
    url.search = ''
    url.hash = ''
    return { ...event, url: url.toString() }
  } catch {
    return null
  }
}
