/**
 * Reine Einwilligungslogik (TDDDG § 25, DSGVO Art. 6 Abs. 1 lit. a und Art. 7).
 * Kein Zugriff auf window, document oder localStorage: alles hier ist mit node --test prüfbar.
 * Browser-Anbindung: lib/cookie-consent-client.ts.
 */

export const COOKIE_CONSENT_STORAGE_KEY = 'cookieConsent'
export const COOKIE_CONSENT_CHANGED_EVENT = 'cookieConsentChanged'
export const OPEN_COOKIE_SETTINGS_EVENT = 'openCookieSettings'

/**
 * Version 2: Banner mit gleichwertigem "Alle ablehnen" und benannten Diensten.
 * Entscheidungen ohne oder mit anderer Version gelten als nicht getroffen: das Banner erscheint erneut,
 * und bis zur neuen Entscheidung wird nichts geladen. Bei geänderten Zwecken oder Diensten hochzählen.
 */
export const COOKIE_CONSENT_VERSION = 2

export type ConsentCategory = 'analytics' | 'marketing'
export const CONSENT_CATEGORIES: readonly ConsentCategory[] = ['analytics', 'marketing']

export interface CookieConsent {
  necessary: true
  analytics: boolean
  marketing: boolean
}

export const DEFAULT_CONSENT: CookieConsent = { necessary: true, analytics: false, marketing: false }
export const ACCEPT_ALL_CONSENT: CookieConsent = { necessary: true, analytics: true, marketing: true }
export const REJECT_ALL_CONSENT: CookieConsent = { necessary: true, analytics: false, marketing: false }

type ConsentValue = 'granted' | 'denied'

export function normalizeConsent(input: { analytics?: unknown; marketing?: unknown }): CookieConsent {
  return { necessary: true, analytics: input.analytics === true, marketing: input.marketing === true }
}

/** Liefert null, wenn noch keine gültige Entscheidung in der aktuellen Version vorliegt. */
export function parseStoredConsent(raw: string | null | undefined): CookieConsent | null {
  if (typeof raw !== 'string' || !raw) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
    const record = parsed as Record<string, unknown>
    if (record.version !== COOKIE_CONSENT_VERSION) return null
    return normalizeConsent(record)
  } catch {
    return null
  }
}

/** Speichert Version und Zeitpunkt mit, damit die Entscheidung nachvollziehbar bleibt. */
export function serializeConsent(consent: CookieConsent, now: Date): string {
  const normalized = normalizeConsent(consent)
  return JSON.stringify({ ...normalized, version: COOKIE_CONSENT_VERSION, updatedAt: now.toISOString() })
}

export function hasAnyTrackingConsent(consent: CookieConsent | null | undefined): boolean {
  return Boolean(consent && (consent.analytics || consent.marketing))
}

export function deniedCategories(consent: CookieConsent | null | undefined): ConsentCategory[] {
  return CONSENT_CATEGORIES.filter(category => !consent?.[category])
}

/** Kategorien, die vorher erlaubt waren und jetzt nicht mehr: das ist ein Widerruf. */
export function revokedCategories(
  previous: CookieConsent | null | undefined,
  next: CookieConsent | null | undefined
): ConsentCategory[] {
  return CONSENT_CATEGORIES.filter(category => previous?.[category] === true && next?.[category] !== true)
}

/**
 * Kategorien, deren Dienste jetzt gestoppt werden müssen: widerrufene Kategorien und alle Kategorien,
 * deren Dienste in dieser Seite schon laufen, aber keine Einwilligung (mehr) haben. Letzteres fängt Fälle ab,
 * in denen der Widerruf nicht als Wechsel sichtbar wird, etwa wenn ein anderer Tab schon abgelehnt hat,
 * bevor dessen storage-Event ankam, oder nach der Rückkehr aus dem Back-Forward-Cache.
 */
export function categoriesToStop(
  previous: CookieConsent | null | undefined,
  next: CookieConsent | null | undefined,
  active: Iterable<ConsentCategory>
): ConsentCategory[] {
  const revoked = revokedCategories(previous, next)
  const running = new Set(active)
  return CONSENT_CATEGORIES.filter(
    category => next?.[category] !== true && (revoked.includes(category) || running.has(category))
  )
}

/** Google Consent Mode v2: Marketing steuert alle ad_*-Signale, Analyse steuert analytics_storage. */
export function googleConsentState(consent: CookieConsent | null | undefined): {
  ad_storage: ConsentValue
  ad_user_data: ConsentValue
  ad_personalization: ConsentValue
  analytics_storage: ConsentValue
} {
  const marketing: ConsentValue = consent?.marketing ? 'granted' : 'denied'
  return {
    ad_storage: marketing,
    ad_user_data: marketing,
    ad_personalization: marketing,
    analytics_storage: consent?.analytics ? 'granted' : 'denied',
  }
}

export const GOOGLE_CONSENT_DEFAULTS = googleConsentState(DEFAULT_CONSENT)

/**
 * Microsoft Clarity (consentv2). ad_Storage bleibt immer denied: Microsoft Advertising ist
 * in keiner Kategorie genannt, also holen wir dafür auch keine Einwilligung ein.
 */
export function clarityConsentState(consent: CookieConsent | null | undefined): {
  ad_Storage: ConsentValue
  analytics_Storage: ConsentValue
} {
  return { ad_Storage: 'denied', analytics_Storage: consent?.analytics ? 'granted' : 'denied' }
}

export interface GoogleTagIds {
  analyticsId?: string
  adsId?: string
}

/** Nur die Ziele konfigurieren, für die eine Einwilligung vorliegt (Consent Mode "basic"). */
export function googleTagDestinations(consent: CookieConsent | null | undefined, ids: GoogleTagIds): string[] {
  const destinations: string[] = []
  if (consent?.analytics && ids.analyticsId) destinations.push(ids.analyticsId)
  if (consent?.marketing && ids.adsId) destinations.push(ids.adsId)
  return destinations
}

/** Die ID, mit der gtag.js geladen wird. null heißt: gtag.js wird gar nicht geladen. */
export function googleTagScriptId(consent: CookieConsent | null | undefined, ids: GoogleTagIds): string | null {
  return googleTagDestinations(consent, ids)[0] ?? null
}

/** Die Kategorie, die für eine Google-Ziel-ID eingewilligt sein muss. */
export function categoryForGoogleTag(id: string, ids: GoogleTagIds): ConsentCategory | null {
  if (ids.analyticsId && id === ids.analyticsId) return 'analytics'
  if (ids.adsId && id === ids.adsId) return 'marketing'
  return null
}

const TRACKING_COOKIE_PATTERNS: Record<ConsentCategory, RegExp[]> = {
  // Google Analytics 4 und Microsoft Clarity (Erstanbieter-Cookies auf unserer Domain)
  analytics: [/^_ga$/, /^_ga_[A-Za-z0-9]+$/, /^_gid$/, /^_gat(_.*)?$/, /^_clck$/, /^_clsk$/],
  // Google Ads Conversion Linker
  marketing: [/^_gcl_[A-Za-z0-9_]+$/, /^_gac_.+$/],
}

/** Namen der Tracking-Cookies aus document.cookie, die zu den übergebenen Kategorien gehören. */
export function trackingCookieNames(cookieHeader: string, categories: readonly ConsentCategory[]): string[] {
  const patterns = categories.flatMap(category => TRACKING_COOKIE_PATTERNS[category])
  const names = new Set<string>()
  for (const part of cookieHeader.split(';')) {
    const name = part.split('=')[0]?.trim()
    if (name && patterns.some(pattern => pattern.test(name))) names.add(name)
  }
  return [...names]
}

/**
 * document.cookie-Zuweisungen, die ein Cookie auf dem Host und allen übergeordneten Domains löschen.
 * GA setzt seine Cookies auf die oberste mögliche Domain (z. B. .price-action-trader.de).
 */
export function cookieDeletionStrings(name: string, hostname: string): string[] {
  const base = `${name}=; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=/`
  const strings = [base]
  const host = hostname.trim().toLowerCase().replace(/\.$/, '')
  const isIpAddress = /^[\d.]+$/.test(host) || host.includes(':')
  if (!host || isIpAddress) return strings

  const labels = host.split('.')
  for (let index = 0; index <= labels.length - 2; index += 1) {
    strings.push(`${base}; Domain=${labels.slice(index).join('.')}`)
  }
  return strings
}
