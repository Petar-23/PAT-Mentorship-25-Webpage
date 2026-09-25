import { useSyncExternalStore } from 'react'
import { sanitizePublicEnv } from '@/lib/public-env'
import {
  COOKIE_CONSENT_CHANGED_EVENT,
  COOKIE_CONSENT_STORAGE_KEY,
  OPEN_COOKIE_SETTINGS_EVENT,
  categoriesToStop,
  clarityConsentState,
  cookieDeletionStrings,
  deniedCategories,
  googleConsentState,
  parseStoredConsent,
  serializeConsent,
  trackingCookieNames,
  type ConsentCategory,
  type CookieConsent,
  type GoogleTagIds,
} from '@/lib/cookie-consent'

/**
 * Browser-Anbindung der Einwilligung: localStorage, Events zwischen Komponenten und Tabs,
 * Widerruf bereits geladener Dienste. Die Logik selbst steht in lib/cookie-consent.ts.
 */

type ConsentListener = (next: CookieConsent | null, previous: CookieConsent | null) => void

const listeners = new Set<ConsentListener>()
const activeCategories = new Set<ConsentCategory>()
let cachedRaw: string | null | undefined
let cachedConsent: CookieConsent | null = null
// Stand, den alle Dienste zuletzt gemeldet bekommen haben. Getrennt vom Lese-Cache, damit ein Render
// zwischen Speichern im anderen Tab und dem storage-Event den Widerruf nicht verschluckt.
let lastNotifiedConsent: CookieConsent | null | undefined
// Entscheidung, die nicht in localStorage gespeichert werden konnte. Sie hat Vorrang vor einem älteren gespeicherten Wert,
// sonst würde etwa ein Widerruf von einer früheren Einwilligung überdeckt, wenn setItem scheitert (Speicher voll).
let memoryFallbackRaw: string | null = null
let areWindowListenersAttached = false

export function getGoogleTagIds(): GoogleTagIds {
  return {
    analyticsId: sanitizePublicEnv(process.env.NEXT_PUBLIC_GA_ID),
    adsId: sanitizePublicEnv(process.env.NEXT_PUBLIC_GOOGLE_ADS_ID),
  }
}

function readRawConsent(): string | null {
  if (typeof window === 'undefined') return null
  if (memoryFallbackRaw !== null) return memoryFallbackRaw
  try {
    return window.localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY)
  } catch {
    return null
  }
}

/** Aktuelle Entscheidung oder null, solange keine gültige Entscheidung vorliegt. Gleiche Referenz, solange sich nichts ändert. */
export function readCookieConsent(): CookieConsent | null {
  const raw = readRawConsent()
  if (raw !== cachedRaw) {
    cachedRaw = raw
    cachedConsent = parseStoredConsent(raw)
  }
  if (lastNotifiedConsent === undefined) lastNotifiedConsent = cachedConsent
  return cachedConsent
}

/** Von Google-Tag und Clarity gemeldet, sobald sie für eine Kategorie Daten erheben dürfen und geladen werden. */
export function markTrackingActive(category: ConsentCategory) {
  activeCategories.add(category)
}

export function clearTrackingCookies(categories: readonly ConsentCategory[]) {
  if (typeof document === 'undefined' || categories.length === 0) return
  try {
    for (const name of trackingCookieNames(document.cookie, categories)) {
      for (const assignment of cookieDeletionStrings(name, window.location.hostname)) {
        document.cookie = assignment
      }
    }
  } catch {
    // Cookies können blockiert sein. Dann gibt es auch nichts zu löschen.
  }
}

/** Beendet bereits geladene Dienste in dieser Seite, soweit das ohne Neuladen geht, und löscht deren Cookies. */
function stopRevokedTracking(next: CookieConsent | null, revoked: readonly ConsentCategory[]) {
  if (revoked.length === 0) return

  if (typeof window.gtag === 'function') {
    window.gtag('consent', 'update', googleConsentState(next))
    const { analyticsId, adsId } = getGoogleTagIds()
    const flags = window as unknown as Record<string, unknown>
    if (analyticsId && revoked.includes('analytics')) flags[`ga-disable-${analyticsId}`] = true
    if (adsId && revoked.includes('marketing')) flags[`ga-disable-${adsId}`] = true
  }

  if (revoked.includes('analytics') && typeof window.clarity === 'function') {
    window.clarity('consentv2', clarityConsentState(next))
    // Löscht die Clarity-Cookies und beendet die Aufzeichnung bis zu einer neuen Einwilligung.
    window.clarity('consent', false)
  }

  clearTrackingCookies(revoked)
}

function notify(previous: CookieConsent | null) {
  const next = readCookieConsent()
  lastNotifiedConsent = next
  // Nicht nur Wechsel von erlaubt zu nicht erlaubt: Alles, was in dieser Seite läuft und keine Einwilligung hat, wird gestoppt.
  const stopped = categoriesToStop(previous, next, activeCategories)
  stopRevokedTracking(next, stopped)
  for (const listener of listeners) listener(next, previous)
  return { next, stopped }
}

function handleStorage(event: StorageEvent) {
  if (event.key !== null && event.key !== COOKIE_CONSENT_STORAGE_KEY) return
  // Anderer Tab hat entschieden. Kein Neuladen im Hintergrund; bereits geladene Dienste werden gestoppt.
  notify(lastNotifiedConsent ?? null)
}

function handlePageShow(event: PageTransitionEvent) {
  // Aus dem Back-Forward-Cache zurück: storage-Events aus der Zwischenzeit sind verloren, also neu abgleichen.
  if (event.persisted) notify(lastNotifiedConsent ?? null)
}

/** Für useSyncExternalStore und für Dienste, die auf Änderungen reagieren. Liefert die Abmeldung. */
export function subscribeToCookieConsent(listener: ConsentListener): () => void {
  listeners.add(listener)
  if (!areWindowListenersAttached && typeof window !== 'undefined') {
    window.addEventListener('storage', handleStorage)
    window.addEventListener('pageshow', handlePageShow)
    areWindowListenersAttached = true
  }
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0 && areWindowListenersAttached) {
      window.removeEventListener('storage', handleStorage)
      window.removeEventListener('pageshow', handlePageShow)
      areWindowListenersAttached = false
    }
  }
}

/**
 * Speichert die Entscheidung und informiert alle Dienste.
 * needsReload ist true, wenn eine Kategorie ohne Einwilligung ist, deren Skripte in dieser Seite schon laufen:
 * gtag.js und Clarity lassen sich nicht vollständig entladen, erst ein Neuladen stellt sicher, dass nichts mehr gesendet wird.
 */
export function saveCookieConsent(consent: CookieConsent): { needsReload: boolean } {
  const previous = lastNotifiedConsent !== undefined ? lastNotifiedConsent : readCookieConsent()
  const serialized = serializeConsent(consent, new Date())
  try {
    window.localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, serialized)
    memoryFallbackRaw = null
  } catch {
    // Speicher blockiert oder voll: Die Entscheidung gilt dann nur bis zum Neuladen. Eine ältere gespeicherte
    // Entscheidung darf danach nicht wieder aufleben, deshalb wird sie entfernt (klappt das nicht, ist Speicher ganz gesperrt).
    memoryFallbackRaw = serialized
    try {
      window.localStorage.removeItem(COOKIE_CONSENT_STORAGE_KEY)
    } catch {
      // Nichts zu tun.
    }
  }

  const { stopped } = notify(previous)
  window.dispatchEvent(new CustomEvent(COOKIE_CONSENT_CHANGED_EVENT))

  return { needsReload: stopped.some(category => activeCategories.has(category)) }
}

/** Löscht Reste von Tracking-Cookies, für die keine Einwilligung (mehr) vorliegt. */
export function clearCookiesWithoutConsent() {
  clearTrackingCookies(deniedCategories(readCookieConsent()))
}

export function openCookieSettings() {
  window.dispatchEvent(new CustomEvent(OPEN_COOKIE_SETTINGS_EVENT))
}

const subscribeStore = (onChange: () => void) => subscribeToCookieConsent(() => onChange())
const getServerSnapshot = () => undefined

/** undefined: noch nicht im Browser gelesen. null: keine gültige Entscheidung. Sonst die Entscheidung. */
export function useCookieConsent(): CookieConsent | null | undefined {
  return useSyncExternalStore<CookieConsent | null | undefined>(subscribeStore, readCookieConsent, getServerSnapshot)
}

declare global {
  interface Window {
    clarity?: (...args: unknown[]) => void
  }
}
