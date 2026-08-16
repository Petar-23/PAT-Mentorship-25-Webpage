export const COOKIE_CONSENT_STORAGE_KEY = 'cookieConsent'

const COOKIE_CONSENT_CHANGED_EVENT = 'cookieConsentChanged'
const OPEN_COOKIE_SETTINGS_EVENT = 'openCookieSettings'

export type CookieConsent = {
  necessary: boolean
  analytics: boolean
  marketing: boolean
}

export type CookieConsentSnapshot = {
  consent: CookieConsent
  hasSavedConsent: boolean
}

export const DEFAULT_COOKIE_CONSENT: CookieConsent = Object.freeze({
  necessary: true,
  analytics: false,
  marketing: false,
})

const SERVER_COOKIE_CONSENT_SNAPSHOT: CookieConsentSnapshot = Object.freeze({
  consent: DEFAULT_COOKIE_CONSENT,
  hasSavedConsent: false,
})

let cachedSerializedConsent: string | null | undefined
let cachedSnapshot = SERVER_COOKIE_CONSENT_SNAPSHOT
const subscribers = new Set<() => void>()

export function normalizeCookieConsent(value: Partial<CookieConsent>): CookieConsent {
  return {
    necessary: true,
    analytics: value.analytics === true,
    marketing: value.marketing === true,
  }
}

export function parseCookieConsent(serialized: string | null): CookieConsent | null {
  if (!serialized) return null

  try {
    const parsed: unknown = JSON.parse(serialized)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null

    const candidate = parsed as Partial<CookieConsent>
    if (typeof candidate.necessary !== 'boolean') return null
    return normalizeCookieConsent(candidate)
  } catch {
    return null
  }
}

export function cookieConsentSnapshotFromSerialized(
  serialized: string | null
): CookieConsentSnapshot {
  const consent = parseCookieConsent(serialized)
  return consent
    ? { consent, hasSavedConsent: true }
    : SERVER_COOKIE_CONSENT_SNAPSHOT
}

function readSerializedConsent() {
  if (typeof window === 'undefined') return null

  try {
    return window.localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY)
  } catch {
    return null
  }
}

function invalidateSnapshot() {
  cachedSerializedConsent = undefined
}

function notifySubscribers() {
  invalidateSnapshot()
  for (const subscriber of subscribers) subscriber()
}

function handleStorageChange(event: StorageEvent) {
  if (event.key === COOKIE_CONSENT_STORAGE_KEY || event.key === null) notifySubscribers()
}

export function getCookieConsentSnapshot(): CookieConsentSnapshot {
  const serialized = readSerializedConsent()
  if (serialized === cachedSerializedConsent) return cachedSnapshot

  cachedSerializedConsent = serialized
  cachedSnapshot = cookieConsentSnapshotFromSerialized(serialized)
  return cachedSnapshot
}

export function getCookieConsentServerSnapshot() {
  return SERVER_COOKIE_CONSENT_SNAPSHOT
}

export function subscribeCookieConsent(subscriber: () => void) {
  subscribers.add(subscriber)

  if (subscribers.size === 1) {
    window.addEventListener('storage', handleStorageChange)
    window.addEventListener(COOKIE_CONSENT_CHANGED_EVENT, notifySubscribers)
  }

  return () => {
    subscribers.delete(subscriber)
    if (subscribers.size === 0) {
      window.removeEventListener('storage', handleStorageChange)
      window.removeEventListener(COOKIE_CONSENT_CHANGED_EVENT, notifySubscribers)
    }
  }
}

export function saveCookieConsent(value: Partial<CookieConsent>) {
  const consent = normalizeCookieConsent(value)
  window.localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, JSON.stringify(consent))
  window.dispatchEvent(new CustomEvent(COOKIE_CONSENT_CHANGED_EVENT))
  return consent
}

export function requestCookieSettings() {
  window.dispatchEvent(new CustomEvent(OPEN_COOKIE_SETTINGS_EVENT))
}

export function subscribeCookieSettingsRequest(openSettings: () => void) {
  window.addEventListener(OPEN_COOKIE_SETTINGS_EVENT, openSettings)
  return () => window.removeEventListener(OPEN_COOKIE_SETTINGS_EVENT, openSettings)
}
