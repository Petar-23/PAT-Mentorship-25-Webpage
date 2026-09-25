// Reine Hilfsfunktionen für die Research-Oberfläche (Texte, Links, Formate).
// Ohne Server- oder React-Abhängigkeiten: Server-Seiten, Client-Komponenten
// und node:test importieren dieselben Funktionen. Nutzertexte sind englisch.

import {
  RESEARCH_CONSENT_VERSIONS,
  RESEARCH_DEFAULT_INTERVAL,
  RESEARCH_DEFAULT_TIER,
  RESEARCH_TIER_DETAILS,
  formatUsd,
  isResearchInterval,
  isResearchTier,
} from './config.mjs'

/** @typedef {import('./config.mjs').ResearchTier} ResearchTier */
/** @typedef {import('./config.mjs').ResearchInterval} ResearchInterval */
/** @typedef {(path: string) => string} ResearchHref */

// Darstellungs-Präferenz (hell/dunkel); das Layout liest sie beim ersten Rendern.
export const RESEARCH_THEME_COOKIE = 'pat-research-theme'

const MAX_REDIRECT_LENGTH = 2048
const REDIRECT_PROBE_ORIGIN = 'https://research.invalid'

/**
 * Erster Wert eines Next.js-Suchparameters.
 * @param {string | string[] | undefined | null} value
 * @returns {string | undefined}
 */
export function firstSearchParam(value) {
  if (Array.isArray(value)) return typeof value[0] === 'string' ? value[0] : undefined
  return typeof value === 'string' ? value : undefined
}

/**
 * Nur relative Pfade derselben Origin sind als Rücksprungziel erlaubt.
 * Abgelehnt: absolute URLs, "//host", Backslashes ("/\\host" behandeln
 * Browser wie "//host") und Steuerzeichen (Tab/Zeilenumbruch entfernt der
 * URL-Parser, aus "/\t/host" würde sonst "//host").
 *
 * Zurückgegeben wird die vom URL-Parser NORMALISIERTE Form, nie der Rohwert:
 * Punkt-Segmente wie "/..//evil.com" oder "/%2e%2e//evil.com" löst der Parser
 * zu "//evil.com" auf, und genau so würden Clerk bzw. router.push den Rohwert
 * später auflösen (→ https://evil.com). Deshalb wird der normalisierte Pfad
 * geprüft und weitergegeben. Kodierte Schrägstriche (%2F, %5C) im Pfad werden
 * zusätzlich abgelehnt, falls ein Glied der Kette sie später dekodiert.
 * @param {unknown} value
 * @returns {string | null}
 */
export function safeResearchRedirectPath(value) {
  if (typeof value !== 'string') return null
  if (value.length === 0 || value.length > MAX_REDIRECT_LENGTH) return null
  if (!value.startsWith('/') || value.startsWith('//')) return null
  if (/[\\\u0000-\u001f\u007f]/.test(value)) return null
  let url
  try {
    url = new URL(value, REDIRECT_PROBE_ORIGIN)
  } catch {
    return null
  }
  if (url.origin !== REDIRECT_PROBE_ORIGIN) return null
  const { pathname } = url
  if (!pathname.startsWith('/') || pathname.startsWith('//')) return null
  if (/%(2f|5c)/i.test(pathname)) return null
  const normalized = `${pathname}${url.search}${url.hash}`
  return normalized.length > MAX_REDIRECT_LENGTH ? null : normalized
}

/**
 * Anmelde-Link mit Rücksprung zur aufgerufenen Research-Seite.
 * @param {ResearchHref} href researchHref, an den Basis-Pfad gebunden
 * @param {string} returnPath logischer Pfad (ohne Basis), darf eine Query enthalten
 */
export function researchSignInHref(href, returnPath) {
  const signIn = href('/sign-in')
  const isAuthPage = /^\/sign-(in|up)(\/|\?|$)/.test(returnPath)
  const target = safeResearchRedirectPath(href(isAuthPage ? '/' : returnPath))
  return target ? `${signIn}?redirect_url=${encodeURIComponent(target)}` : signIn
}

/**
 * Ziele für die Clerk-Komponenten auf /sign-in und /sign-up. Das Ziel wird
 * immer als forceRedirectUrl gesetzt, damit Clerk einen unsicheren
 * redirect_url-Parameter aus der Adresszeile nie selbst auswertet.
 * @param {ResearchHref} href
 * @param {unknown} rawRedirect
 */
export function researchAuthUrls(href, rawRedirect) {
  const redirect = safeResearchRedirectPath(rawRedirect)
  const home = href('/')
  const suffix = redirect ? `?redirect_url=${encodeURIComponent(redirect)}` : ''
  return {
    target: redirect ?? home,
    home,
    signInPath: href('/sign-in'),
    signUpPath: href('/sign-up'),
    signInUrl: `${href('/sign-in')}${suffix}`,
    signUpUrl: `${href('/sign-up')}${suffix}`,
  }
}

/**
 * Vorauswahl der Pricing-Seite aus ?tier=…&interval=… (sonst Member, monatlich).
 * @param {Record<string, string | string[] | undefined> | null | undefined} params
 * @returns {{ tier: ResearchTier, interval: ResearchInterval }}
 */
export function parseResearchPlanSelection(params) {
  const tier = firstSearchParam(params?.tier)
  const interval = firstSearchParam(params?.interval)
  return {
    tier: isResearchTier(tier) ? tier : /** @type {ResearchTier} */ (RESEARCH_DEFAULT_TIER),
    interval: isResearchInterval(interval) ? interval : /** @type {ResearchInterval} */ (RESEARCH_DEFAULT_INTERVAL),
  }
}

/** @param {ResearchInterval} interval */
export function researchIntervalLabel(interval) {
  return interval === 'year' ? 'Annual' : 'Monthly'
}

/**
 * Preisangabe einer Stufe. Beim Jahrespreis steht die Jahressumme im
 * Vordergrund, dazu die geschenkten Monate gegenüber zwölf Monatsbeiträgen.
 * @param {ResearchTier} tier
 * @param {ResearchInterval} interval
 */
export function researchPlanPrice(tier, interval) {
  const details = RESEARCH_TIER_DETAILS[tier]
  if (interval === 'year') {
    const freeMonths = Math.round((details.monthlyUsd * 12 - details.annualUsd) / details.monthlyUsd)
    return {
      amount: formatUsd(details.annualUsd),
      period: 'per year',
      summary: `${formatUsd(details.annualUsd)} per year`,
      saving: freeMonths > 0 ? `${freeMonths} ${freeMonths === 1 ? 'month' : 'months'} free` : null,
    }
  }
  return {
    amount: formatUsd(details.monthlyUsd),
    period: 'per month',
    summary: `${formatUsd(details.monthlyUsd)} per month`,
    saving: null,
  }
}

/**
 * Teilt den Einwilligungstext, damit "Terms of Service" verlinkt werden kann.
 * Fehlt die Formulierung (Text geändert), liefert die Funktion null.
 * @param {string} text
 * @param {string} [linkText]
 */
export function splitTermsLink(text, linkText = 'Terms of Service') {
  const index = text.indexOf(linkText)
  if (index === -1) return null
  return { before: text.slice(0, index), link: linkText, after: text.slice(index + linkText.length) }
}

/**
 * Body für POST /api/research/checkout. Die Textversionen gehören zu genau den
 * Einwilligungstexten, die die Pricing-Seite rendert (RESEARCH_CONSENT_TEXT aus
 * demselben Modul). Hat sich eine Textversion seit dem Laden der Seite
 * geändert (neues Deployment), lehnt die Route mit 409 `consent_outdated` ab
 * und protokolliert nichts. Dass jede Wortlaut-Änderung eine neue Version
 * bekommt, prüft der Ledger-Test in ui.test.mjs.
 * @param {ResearchTier} tier
 * @param {ResearchInterval} interval
 */
export function researchCheckoutRequestBody(tier, interval) {
  return {
    tier,
    interval,
    acceptTerms: /** @type {const} */ (true),
    waiveWithdrawal: /** @type {const} */ (true),
    termsVersion: RESEARCH_CONSENT_VERSIONS.terms,
    withdrawalWaiverVersion: RESEARCH_CONSENT_VERSIONS.withdrawalWaiver,
  }
}

/**
 * Sekunden aus einem Retry-After-Header. Unsere Routen senden nur die
 * Sekunden-Form; alles andere (HTTP-Datum, Müll, fehlender Header) ergibt null.
 * @param {string | null | undefined} value
 * @returns {number | null}
 */
export function parseRetryAfterSeconds(value) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return /^\d{1,9}$/.test(trimmed) ? Number(trimmed) : null
}

/**
 * "Too many attempts. Please try again in about N minutes." (N aufgerundet,
 * mindestens 1); ohne bekannte Wartezeit "… Please try again later."
 * @param {number | null | undefined} retryAfterSeconds
 */
export function researchRateLimitMessage(retryAfterSeconds) {
  if (typeof retryAfterSeconds !== 'number' || !Number.isFinite(retryAfterSeconds) || retryAfterSeconds < 0) {
    return 'Too many attempts. Please try again later.'
  }
  const minutes = Math.max(1, Math.ceil(retryAfterSeconds / 60))
  return `Too many attempts. Please try again in about ${minutes} ${minutes === 1 ? 'minute' : 'minutes'}.`
}

const MAX_SERVER_MESSAGE_LENGTH = 300

/**
 * Nutzertext zu den Fehlercodes von POST /api/research/checkout.
 *
 * `already_subscribed` kommt auch für ein offenes past_due/incomplete-Abo ohne
 * Zugang (Kulanz abgelaufen). Der Code allein sagt also nicht "aktiv": die
 * Route formuliert den passenden Text selbst, deshalb wird ihre Meldung hier
 * übernommen; ohne Meldung bleibt der Text statusneutral.
 * @param {unknown} code
 * @param {unknown} [serverMessage] `message` aus der JSON-Antwort der Route
 * @param {number | null} [retryAfterSeconds] aus dem Retry-After-Header (429)
 * @returns {{ message: string, action: 'account' | 'sign-in' | 'reload' | null }}
 */
export function researchCheckoutError(code, serverMessage, retryAfterSeconds) {
  switch (code) {
    case 'already_subscribed': {
      const message = typeof serverMessage === 'string' ? serverMessage.trim() : ''
      return {
        message: message && message.length <= MAX_SERVER_MESSAGE_LENGTH
          ? message
          : 'You already have a PAT Research subscription. Please manage it from your account instead of subscribing again.',
        action: 'account',
      }
    }
    case 'consent_required':
      return { message: 'Please confirm both statements above to continue.', action: null }
    case 'consent_outdated':
      return {
        message: 'The terms were updated since you opened this page. Please reload the page and confirm again.',
        action: 'reload',
      }
    case 'rate_limited':
      return { message: researchRateLimitMessage(retryAfterSeconds), action: null }
    case 'signed_out':
      return { message: 'Your session has ended. Please sign in again to continue.', action: 'sign-in' }
    case 'no_email':
      return { message: 'Your account needs an email address before you can subscribe. Please add one in your account settings.', action: null }
    case 'invalid_request':
      return { message: 'Please choose a plan and try again.', action: null }
    default:
      return { message: 'Checkout could not be started. Please try again in a moment.', action: null }
  }
}

/**
 * Nutzertext zu den Antworten von POST /api/research/portal.
 *
 * "Kein Abo" nur beim Code `no_customer`, nie allein wegen 404: Auch der
 * Kill-Switch antwortet mit 404 (Route: `not_found`, Middleware: Text ohne
 * Code), und ein zahlendes Mitglied darf dann nicht "kein Abo" lesen.
 * @param {number} status
 * @param {unknown} code
 * @param {number | null} [retryAfterSeconds] aus dem Retry-After-Header (429)
 */
export function researchPortalError(status, code, retryAfterSeconds) {
  if (code === 'no_customer') return 'No subscription found yet.'
  if (status === 401 || code === 'signed_out') return 'Your session has ended. Please sign in again.'
  if (status === 429 || code === 'rate_limited') return researchRateLimitMessage(retryAfterSeconds)
  return 'Billing could not be opened. Please try again in a moment.'
}

/**
 * Nur https-Ziele (Stripe) oder relative Pfade (Test-Modus) werden geöffnet.
 * @param {unknown} url
 * @returns {url is string}
 */
export function isSafeBillingRedirect(url) {
  if (typeof url !== 'string') return false
  if (safeResearchRedirectPath(url)) return true
  try {
    return new URL(url).protocol === 'https:'
  } catch {
    return false
  }
}

// API-Routen haben KEINEN Basis-Pfad: sie liegen auf jedem Host unter /api/research/*.
export const RESEARCH_CHECKOUT_ENDPOINT = '/api/research/checkout'
export const RESEARCH_PORTAL_ENDPOINT = '/api/research/portal'

/** @typedef {(input: string, init: RequestInit) => Promise<Response>} ResearchFetch */

/** @type {ResearchFetch} */
const browserFetch = (input, init) => fetch(input, init)

/**
 * POST mit JSON-Body. Liefert die Antwort, ihr JSON (sonst null, z. B. beim
 * Text-404 der Middleware) und die Wartezeit aus Retry-After (nur bei 429).
 * Netzwerkfehler und Abbruch werfen weiter.
 * @param {ResearchFetch} fetchImpl
 * @param {string} endpoint
 * @param {unknown} body
 * @param {AbortSignal | undefined} signal
 */
async function postResearchJson(fetchImpl, endpoint, body, signal) {
  const response = await fetchImpl(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  })
  const data = /** @type {{ url?: unknown, code?: unknown, message?: unknown } | null} */ (
    await response.json().catch(() => null)
  )
  const retryAfter = response.status === 429 ? parseRetryAfterSeconds(response.headers.get('Retry-After')) : null
  return { response, data, retryAfter }
}

/**
 * Startet den Checkout der Pricing-Seite: POST mit genau dem Body aus
 * researchCheckoutRequestBody (inkl. Textversionen). Wirft nie; nach einem
 * Abbruch prüft der Aufrufer `signal.aborted` selbst.
 * @param {{ tier: ResearchTier, interval: ResearchInterval, signal?: AbortSignal, fetch?: ResearchFetch }} params
 * @returns {Promise<{ url: string } | { error: ReturnType<typeof researchCheckoutError> }>}
 */
export async function requestResearchCheckout({ tier, interval, signal, fetch: fetchImpl = browserFetch }) {
  try {
    const { response, data, retryAfter } = await postResearchJson(
      fetchImpl, RESEARCH_CHECKOUT_ENDPOINT, researchCheckoutRequestBody(tier, interval), signal,
    )
    if (response.ok && isSafeBillingRedirect(data?.url)) return { url: data.url }
    return { error: response.ok ? researchCheckoutError(null) : researchCheckoutError(data?.code, data?.message, retryAfter) }
  } catch {
    return { error: researchCheckoutError(null) }
  }
}

/**
 * Öffnet das Stripe-Billing-Portal (Button auf der Kontoseite). Wirft nie;
 * nach einem Abbruch prüft der Aufrufer `signal.aborted` selbst.
 * @param {{ signal?: AbortSignal, fetch?: ResearchFetch }} [params]
 * @returns {Promise<{ url: string } | { error: string }>}
 */
export async function requestResearchPortal({ signal, fetch: fetchImpl = browserFetch } = {}) {
  try {
    const { response, data, retryAfter } = await postResearchJson(fetchImpl, RESEARCH_PORTAL_ENDPOINT, {}, signal)
    if (response.ok && isSafeBillingRedirect(data?.url)) return { url: data.url }
    return { error: researchPortalError(response.status, data?.code, retryAfter) }
  } catch {
    return { error: researchPortalError(0, null) }
  }
}

/**
 * Stripe-Checkout-Session-IDs ("cs_test_…", "cs_live_…").
 * @param {unknown} value
 * @returns {value is string}
 */
export function isCheckoutSessionId(value) {
  return typeof value === 'string' && /^cs_[A-Za-z0-9_]{1,250}$/.test(value)
}

// Jeder Abgleich auf /welcome kostet mindestens einen Stripe-API-Aufruf, auch
// für erfundene "cs_…"-IDs. Großzügig für echte Nutzer (Rückkehr von Stripe
// plus einige Klicks auf "Check again"), eng genug gegen Schleifen.
export const RESEARCH_WELCOME_SYNC_RATE_LIMIT = Object.freeze({ windowMs: 60_000, maxAttempts: 10 })

/** @typedef {'active' | 'pending' | 'failed' | 'missing'} ResearchWelcomeState */

/**
 * Zustand der /welcome-Seite nach dem Checkout.
 * - Mitglieder brauchen keinen Stripe-Abgleich (auch nicht beim
 *   router.refresh() direkt nach einem erfolgreichen Abgleich).
 * - Jeder Abgleich zählt gegen ein Rate-Limit pro User; ist es erreicht (oder
 *   nicht prüfbar), wird Stripe nicht gefragt und die Seite zeigt "pending"
 *   mit "Check again".
 * - "failed" nur bei echtem Fehlschlag: der Abgleich meldet `failed` oder die
 *   Session gehört nicht zu diesem User. Vorübergehende Fehler (Stripe-Timeout,
 *   5xx, Datenbank) ergeben "pending" — die Zahlung kann längst durch sein.
 * @param {{
 *   sessionId: string | null
 *   isMember: boolean
 *   consumeRateLimit: () => Promise<{ limited: boolean }>
 *   sync: (sessionId: string) => Promise<{ status: string }>
 *   isForeignSession: (error: unknown) => boolean
 *   onError?: (stage: 'rate_limit' | 'sync', error: unknown) => void
 * }} params
 * @returns {Promise<ResearchWelcomeState>}
 */
export async function resolveResearchWelcomeState(params) {
  const { sessionId, isMember, consumeRateLimit, sync, isForeignSession, onError } = params
  if (isMember) return 'active'
  if (!sessionId) return 'missing'

  try {
    const limit = await consumeRateLimit()
    if (limit.limited) return 'pending'
  } catch (error) {
    onError?.('rate_limit', error)
    return 'pending'
  }

  try {
    const { status } = await sync(sessionId)
    return status === 'active' || status === 'failed' ? status : 'pending'
  } catch (error) {
    if (isForeignSession(error)) return 'failed'
    onError?.('sync', error)
    return 'pending'
  }
}

const dateFormat = new Intl.DateTimeFormat('en-US', { dateStyle: 'long', timeZone: 'UTC' })
const dateTimeFormat = new Intl.DateTimeFormat('en-US', { dateStyle: 'long', timeStyle: 'short', timeZone: 'UTC' })

/** @param {unknown} value */
function toDate(value) {
  if (!(value instanceof Date) && typeof value !== 'string' && typeof value !== 'number') return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

/**
 * "September 28, 2026" (UTC, damit Server und Browser gleich rendern).
 * @param {string | Date | null | undefined} value
 */
export function formatResearchDate(value) {
  const date = toDate(value)
  return date ? dateFormat.format(date) : null
}

/**
 * "September 28, 2026 at 3:00 PM UTC".
 * @param {string | Date | null | undefined} value
 */
export function formatResearchDateTime(value) {
  const date = toDate(value)
  return date ? `${dateTimeFormat.format(date)} UTC` : null
}

/**
 * @typedef {{
 *   hasAccess: boolean
 *   reason: string
 *   status: string | null
 *   tier: string | null
 *   interval: string | null
 *   currentPeriodEnd: string | null
 *   cancelAtPeriodEnd: boolean
 *   cancelAt: string | null
 *   graceEndsAt: string | null
 *   source?: 'subscription' | 'admin' | 'test'
 * }} ResearchMembershipInput
 */

/**
 * @typedef {{
 *   state: 'admin' | 'active' | 'ending' | 'payment_issue' | 'inactive' | 'none'
 *   status: string
 *   detail: string | null
 *   dateLabel: string | null
 *   date: string | null
 *   plan: string | null
 *   interval: string | null
 *   hasSubscription: boolean
 *   needsPaymentUpdate: boolean
 *   isTest: boolean
 * }} ResearchMembershipSummary
 */

/**
 * Mitgliedschaft in einfachen Worten für die Kontoseite.
 * @param {ResearchMembershipInput | null | undefined} access
 * @returns {ResearchMembershipSummary}
 */
export function describeResearchMembership(access) {
  const plan = access && isResearchTier(access.tier) ? RESEARCH_TIER_DETAILS[access.tier].label : null
  const interval = access && isResearchInterval(access.interval) ? researchIntervalLabel(access.interval) : null
  const base = {
    plan,
    interval,
    hasSubscription: Boolean(access && access.reason !== 'none' && access.status),
    needsPaymentUpdate: access?.reason === 'past_due_grace' || access?.reason === 'past_due_expired',
    isTest: access?.source === 'test',
  }

  if (!access) {
    return { ...base, state: 'none', status: 'No membership', detail: 'Choose a plan to unlock the research.', dateLabel: null, date: null }
  }

  if (access.source === 'admin') {
    return { ...base, state: 'admin', status: 'Admin access', detail: 'Your account has full access as an administrator.', dateLabel: null, date: null }
  }

  switch (access.reason) {
    case 'none':
      return { ...base, state: 'none', status: 'No membership', detail: 'Choose a plan to unlock the research.', dateLabel: null, date: null }
    case 'active':
    case 'trialing': {
      const endsAt = access.cancelAt ?? (access.cancelAtPeriodEnd ? access.currentPeriodEnd : null)
      const endDate = formatResearchDate(endsAt)
      if (endDate) {
        return {
          ...base,
          state: 'ending',
          status: `Ends on ${endDate}`,
          detail: 'Your membership will not renew. You keep full access until then.',
          dateLabel: 'Access until',
          date: endDate,
        }
      }
      const renewal = formatResearchDate(access.currentPeriodEnd)
      return { ...base, state: 'active', status: 'Active', detail: null, dateLabel: renewal ? 'Renews on' : null, date: renewal }
    }
    case 'past_due_grace': {
      const graceEnd = formatResearchDateTime(access.graceEndsAt)
      return {
        ...base,
        state: 'payment_issue',
        status: 'Payment issue',
        detail: graceEnd
          ? `Please update your payment method (grace until ${graceEnd}).`
          : 'Please update your payment method.',
        dateLabel: graceEnd ? 'Grace period until' : null,
        date: graceEnd,
      }
    }
    case 'past_due_expired':
      return {
        ...base,
        state: 'inactive',
        status: 'Inactive',
        detail: 'Your last payment did not go through. Update your payment method to restore access.',
        dateLabel: null,
        date: null,
      }
    default:
      return { ...base, state: 'inactive', status: 'Inactive', detail: null, dateLabel: null, date: null }
  }
}
