// Zugangsregeln für PAT Research (reine Funktion, ohne Server-Abhängigkeiten).
// Wird von lib/research/access.ts (Seiten, API, später MCP/RSS/Telegram) und
// von lib/research/subscription-sync.mjs (Webhook-Reihenfolge) genutzt.
//
// Regeln (Reihenfolge ist Teil des Vertrags):
//   1. keine Zeile                               → none
//   2. Stufe ist keine Research-Stufe            → unknown_tier   (kein Zugang)
//   3. currentPeriodEnd fehlt                    → period_ended   (kein Zugang, egal welcher Status)
//      currentPeriodEnd <= jetzt:
//        active/trialing, das sich verlängert (cancelAtPeriodEnd === false,
//        kein cancelAt bis zum Periodenende) und
//        jetzt < min(currentPeriodEnd + 24 h, cancelAt)
//                                                → renewal_pending (Zugang)
//        sonst                                   → period_ended   (kein Zugang)
//   4. active / trialing                         → Zugang
//   5. past_due: (pastDueSince ?? updatedAt) + 72 h > jetzt
//                                                → past_due_grace (Zugang), sonst past_due_expired
//   6. alles andere (canceled, unpaid, incomplete, incomplete_expired, paused, …)
//                                                → inactive       (kein Zugang)
//
// Fehlende oder ungültige Zeitangaben geben NIE Zugang (fail closed).
//
// Warum renewal_pending: Bei der Verlängerung schiebt Stripe current_period_end
// weiter und meldet das per customer.subscription.updated. Bis der Webhook
// verarbeitet ist (normal Sekunden; Stunden, wenn der Endpoint ausfällt und
// Stripe erneut zustellt), steht im Cache noch das alte Periodenende. Ohne
// Karenz verlören zahlende Mitglieder bei JEDER Verlängerung kurz den Zugang,
// und der Checkout-Check "already_subscribed" (hasAccess) ließe in dieser Lücke
// ein zweites Abo zu. Gekündigte Abos (cancelAtPeriodEnd/cancelAt) bekommen
// keine Karenz. Die Karenz ist kürzer als die past_due-Kulanz (72 h), eine
// veraltete Zeile gibt also nie mehr als eine fehlgeschlagene Verlängerung.

import { RESEARCH_PAST_DUE_GRACE_MS, isResearchInterval, isResearchTier } from './config.mjs'

/**
 * Karenz nach currentPeriodEnd für active/trialing-Abos, die sich verlängern,
 * solange der Verlängerungs-Webhook noch nicht verarbeitet ist.
 */
export const RESEARCH_RENEWAL_LEEWAY_MS = 24 * 60 * 60 * 1000

/** @typedef {import('./config.mjs').ResearchTier} ResearchTier */
/** @typedef {import('./config.mjs').ResearchInterval} ResearchInterval */

/**
 * @typedef {'none'
 *   | 'unknown_tier'
 *   | 'period_ended'
 *   | 'active'
 *   | 'trialing'
 *   | 'renewal_pending'
 *   | 'past_due_grace'
 *   | 'past_due_expired'
 *   | 'inactive'} ResearchAccessReason
 */

/** @typedef {Date | string | number | null | undefined} ResearchAccessInstant */

/**
 * Relevante Spalten einer ResearchSubscription-Zeile. `updatedAt` ist optional,
 * damit auch frisch gemappte Stripe-Zeilen (ohne DB-Zeitstempel) geprüft werden
 * können; ohne `pastDueSince` und `updatedAt` gibt past_due keinen Zugang.
 *
 * @typedef {Object} ResearchAccessRow
 * @property {string} status
 * @property {string | null} [tier]
 * @property {string | null} [billingInterval]
 * @property {boolean | null} [cancelAtPeriodEnd]
 * @property {ResearchAccessInstant} [cancelAt]
 * @property {ResearchAccessInstant} [currentPeriodEnd]
 * @property {ResearchAccessInstant} [pastDueSince]
 * @property {ResearchAccessInstant} [updatedAt]
 */

/**
 * Ergebnis der Zugangsprüfung. Zeitpunkte als ISO-Strings (serialisierbar für
 * Client-Komponenten und die API).
 *
 * `graceEndsAt` ist nur bei Status past_due gesetzt: Ende der 72-h-Kulanz,
 * höchstens aber `currentPeriodEnd` (= der Moment, in dem der Zugang endet).
 * Bei `renewal_pending` bleibt es null (keine Zahlungs-Kulanz, nur Webhook-Verzug).
 *
 * @typedef {Object} ResearchAccess
 * @property {boolean} hasAccess
 * @property {ResearchAccessReason} reason
 * @property {string | null} status
 * @property {ResearchTier | null} tier
 * @property {ResearchInterval | null} interval
 * @property {string | null} currentPeriodEnd
 * @property {boolean} cancelAtPeriodEnd
 * @property {string | null} cancelAt
 * @property {string | null} graceEndsAt
 */

/** @type {readonly ResearchAccessReason[]} */
export const RESEARCH_ACCESS_REASONS = Object.freeze([
  'none',
  'unknown_tier',
  'period_ended',
  'active',
  'trialing',
  'renewal_pending',
  'past_due_grace',
  'past_due_expired',
  'inactive',
])

/**
 * Zeitpunkt → Millisekunden. Ungültige oder fehlende Werte → null.
 * @param {ResearchAccessInstant} value
 * @returns {number | null}
 */
function toMs(value) {
  if (value === null || value === undefined) return null
  if (value instanceof Date) {
    const ms = value.getTime()
    return Number.isFinite(ms) ? ms : null
  }
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'string' && value.trim().length > 0) {
    const ms = Date.parse(value)
    return Number.isFinite(ms) ? ms : null
  }
  return null
}

/** @param {number | null} ms */
function toIso(ms) {
  return ms === null ? null : new Date(ms).toISOString()
}

/**
 * Ende der Verlängerungs-Karenz oder null, wenn die Zeile keine bekommt: nur
 * active/trialing mit explizit `cancelAtPeriodEnd === false` und ohne
 * (gültiges) cancelAt bis zum Periodenende. Ungültiges cancelAt → keine Karenz.
 *
 * @param {ResearchAccessRow} row
 * @param {string | null} status
 * @param {number} periodEndMs
 * @returns {number | null}
 */
function renewalLeewayEndMs(row, status, periodEndMs) {
  if (status !== 'active' && status !== 'trialing') return null
  if (row.cancelAtPeriodEnd !== false) return null

  const hasCancelAt = row.cancelAt !== null && row.cancelAt !== undefined
  const cancelAtMs = toMs(row.cancelAt)
  if (hasCancelAt && cancelAtMs === null) return null

  const leewayEndMs = periodEndMs + RESEARCH_RENEWAL_LEEWAY_MS
  return cancelAtMs === null ? leewayEndMs : Math.min(leewayEndMs, cancelAtMs)
}

/**
 * Berechnet den Research-Zugang zu einem Zeitpunkt.
 *
 * @param {ResearchAccessRow | null | undefined} row
 * @param {number} [nowMs] Zeitpunkt der Prüfung (Default: Date.now()).
 * @returns {ResearchAccess}
 */
export function computeResearchAccess(row, nowMs = Date.now()) {
  if (typeof nowMs !== 'number' || !Number.isFinite(nowMs)) {
    throw new TypeError('computeResearchAccess: nowMs must be a finite number')
  }

  if (!row) {
    return {
      hasAccess: false,
      reason: 'none',
      status: null,
      tier: null,
      interval: null,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      cancelAt: null,
      graceEndsAt: null,
    }
  }

  const status = typeof row.status === 'string' && row.status.length > 0 ? row.status : null
  const tier = isResearchTier(row.tier) ? row.tier : null
  const interval = isResearchInterval(row.billingInterval) ? row.billingInterval : null
  const periodEndMs = toMs(row.currentPeriodEnd)

  let graceEndsMs = null
  if (status === 'past_due') {
    const pastDueStartMs = toMs(row.pastDueSince) ?? toMs(row.updatedAt)
    if (pastDueStartMs !== null) {
      const rawGraceEndMs = pastDueStartMs + RESEARCH_PAST_DUE_GRACE_MS
      graceEndsMs = periodEndMs !== null ? Math.min(rawGraceEndMs, periodEndMs) : rawGraceEndMs
    }
  }

  /** @param {boolean} hasAccess @param {ResearchAccessReason} reason @returns {ResearchAccess} */
  const result = (hasAccess, reason) => ({
    hasAccess,
    reason,
    status,
    tier,
    interval,
    currentPeriodEnd: toIso(periodEndMs),
    cancelAtPeriodEnd: row.cancelAtPeriodEnd === true,
    cancelAt: toIso(toMs(row.cancelAt)),
    graceEndsAt: toIso(graceEndsMs),
  })

  // Unbekannte Preise/Stufen (z. B. ein fremder Preis im Research-Produkt)
  // geben nie Zugang.
  if (tier === null) return result(false, 'unknown_tier')

  // Fehlende Periode gibt nie Zugang.
  if (periodEndMs === null) return result(false, 'period_ended')

  // Abgelaufene Periode: nur ein sich verlängerndes active/trialing-Abo behält
  // Zugang, bis der Verlängerungs-Webhook da ist (höchstens 24 h, nie über
  // cancelAt hinaus). Alles andere endet exakt am Periodenende.
  if (periodEndMs <= nowMs) {
    const renewalEndsMs = renewalLeewayEndMs(row, status, periodEndMs)
    return renewalEndsMs !== null && renewalEndsMs > nowMs
      ? result(true, 'renewal_pending')
      : result(false, 'period_ended')
  }

  if (status === 'active') return result(true, 'active')
  if (status === 'trialing') return result(true, 'trialing')

  // Fehlgeschlagene Verlängerung: kurze Kulanz, kein ganzer neuer Zeitraum.
  if (status === 'past_due') {
    return graceEndsMs !== null && graceEndsMs > nowMs
      ? result(true, 'past_due_grace')
      : result(false, 'past_due_expired')
  }

  return result(false, 'inactive')
}
