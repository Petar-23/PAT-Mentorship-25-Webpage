// Ablauf nach dem Absenden von /kuendigen (§ 312k BGB) und /widerrufen (§ 356a BGB).
// DB, Stripe, E-Mail (Google Workspace) und Telegram kommen als Abhängigkeiten herein:
// lib/vertrag-service.ts setzt die echten ein, lib/vertrag-ablauf.test.mjs Attrappen.
//
// ANWALTLICH PRÜFEN: Ablauf und Empfänger der E-Mails (siehe unten) vor dem Livegang freigeben lassen,
// insbesondere dass die vollständige Bestätigung mit Vertragsende nur an die hinterlegte Adresse geht.
//
// Zwei Phasen:
// 1. accept*: vor der Antwort. Eingangs-ID, Zeitpunkt, Bestätigung aus den eigenen Angaben und
//    Speichern in der DB. Nichts davon hängt davon ab, ob es zur E-Mail-Adresse einen Vertrag gibt:
//    Antwort und Antwortzeit verraten keine Mitgliedschaft.
// 2. background: nach der Antwort (next/server `after`). Dauerhaftes Limit, Stripe, E-Mails, Telegram.
//
// Wer bekommt welche E-Mail?
// - Vollständige Bestätigung (alle Angaben, bei Kündigungen das Vertragsende): nur an eine Adresse,
//   die bei Stripe (Kunde), Clerk (bestätigte Adresse des Kontos) oder in der PayPal-Liste zum
//   gefundenen Vertrag hinterlegt ist. Exakter Vergleich, keine Teiltreffer.
// - Neutrale Eingangsbestätigung (ohne Vertragsinformationen, ohne Freitext außer dem bereinigten
//   Namen): an eine abweichende Bestätigungsadresse immer, und zwar vor der Suche bei Stripe, damit
//   auch der Zeitpunkt dieser E-Mail nichts über eine Mitgliedschaft verrät. An die Kontoadresse,
//   wenn sie nicht hinterlegt ist. Ohne hinterlegte Adresse bekommt Petar den Eingang zur manuellen
//   Bearbeitung.
// - Über dem dauerhaften Limit je Adresse bzw. IP: keine E-Mail, nur Meldung an Petar (ohne
//   Personendaten).
// - Über dem Tageslimit für alle Erklärungen zusammen (Angriff über wechselnde IPs und Adressen):
//   keine E-Mails an nicht hinterlegte Adressen, keine internen Kopien, keine Einzelmeldungen an
//   Petar. Hinterlegte Adressen bekommen weiter die vollständige Bestätigung, Stripe läuft normal.

import {
  STATUS_NOTE_TEXT,
  WITHDRAWAL_OUTCOME,
  buildCancellationReceipt,
  buildConfirmationEmail,
  buildNeutralEmail,
  buildWithdrawalReceipt,
  createDeclarationId,
  decideCancellation,
  describeCancellationOutcome,
  openSubscriptionsFor,
  subscriptionMatchesContract,
} from './vertrag-erklaerung.mjs'

/**
 * @typedef {import('./vertrag-erklaerung.mjs').Receipt} Receipt
 * @typedef {import('./vertrag-erklaerung.mjs').Mail} Mail
 * @typedef {import('./vertrag-erklaerung.mjs').PriceConfig} PriceConfig
 * @typedef {import('./vertrag-erklaerung.mjs').SubscriptionFacts} SubscriptionFacts
 * @typedef {import('./vertrag-erklaerung.mjs').CancellationDecision} CancellationDecision
 * @typedef {import('./vertrag-validierung.mjs').KuendigungData} KuendigungData
 * @typedef {import('./vertrag-validierung.mjs').WiderrufData} WiderrufData
 */

// Dauerhaftes Limit über die Datenbank, zusätzlich zum Speicher-Limit in lib/vertrag-request.ts.
// Gezählt werden alle Erklärungen (Kündigung und Widerruf) der letzten 24 Stunden, in denen die
// Adresse als Konto- oder Bestätigungsadresse vorkommt, bzw. vom selben IP-Hash.
// maxPerDay: alle Erklärungen zusammen. Darüber gehen keine E-Mails mehr an Adressen, die nicht zu
// einem Vertrag hinterlegt sind (sonst ließe sich die Funktion über wechselnde IPs und Adressen als
// Spam-Schleuder nutzen). Echte Kündigungen liegen weit darunter.
export const LIMITS = Object.freeze({
  windowMs: 24 * 60 * 60 * 1000,
  maxPerEmail: 3,
  maxPerIp: 20,
  maxPerDay: 30,
})

// Der IP-Hash dient nur dem Limit. Danach wird er gelöscht.
export const IP_HASH_RETENTION_MS = 48 * 60 * 60 * 1000

const STRIPE_BUDGET_MS = 15_000

const SAVE_FAILED =
  'Achtung: Speichern in der Datenbank fehlgeschlagen, Daten stehen im Server-Log (und in der Mail-Kopie, falls eingerichtet).'

/**
 * @typedef {{ ok: true, receipt: Receipt }} PublicResult
 *
 * @typedef {{
 *   id: string,
 *   type: 'kuendigung' | 'widerruf',
 *   name: string,
 *   email: string,
 *   confirmationEmail: string,
 *   contract: string,
 *   kind?: string | null,
 *   reason?: string | null,
 *   timing?: string | null,
 *   requestedDate?: Date | null,
 *   details?: string | null,
 *   receivedAt: Date,
 *   status: string,
 *   statusNote?: string | null,
 *   ipHash: string | null,
 * }} DeclarationRecord
 *
 * @typedef {{
 *   status?: string,
 *   statusNote?: string | null,
 *   stripeSubscriptionId?: string | null,
 *   endsAt?: Date | null,
 *   confirmationSentAt?: Date | null,
 *   mailNote?: string | null,
 * }} DeclarationUpdate
 *
 * @typedef {{ emailCounts: number[], ipCount: number | null, totalCount?: number | null }} RecentCounts
 *
 * @typedef {{
 *   now: () => Date,
 *   randomBytes: (size: number) => Uint8Array,
 *   priceConfig: PriceConfig,
 *   internalCopyEmail: string | null,
 *   saveDeclaration: (record: DeclarationRecord) => Promise<boolean>,
 *   updateDeclaration: (id: string, data: DeclarationUpdate) => Promise<void>,
 *   countRecent: (query: { emails: string[], ipHash: string | null, since: Date, before: Date }) => Promise<RecentCounts>,
 *   purgeIpHashes?: (before: Date) => Promise<void>,
 *   findSubscriptions: (email: string, contract: string, mode: 'open' | 'any') => Promise<SubscriptionFacts[]>,
 *   findPayPalContacts?: (email: string) => Promise<string[]>,
 *   scheduleCancellation: (subscriptionId: string, declarationId: string) => Promise<Date | null>,
 *   sendMail: (to: string, mail: Mail, options: { tag: string, bcc: boolean }) => Promise<boolean>,
 *   notify: (lines: string[]) => Promise<void>,
 *   stripeBudgetMs?: number,
 *   log?: { error: (...args: unknown[]) => void, warn: (...args: unknown[]) => void },
 * }} DeclarationDeps
 *
 * @typedef {{ body: PublicResult, background: () => Promise<void> }} Accepted
 */

// ---------------------------------------------------------------------------
// Hilfen
// ---------------------------------------------------------------------------

/**
 * @template T
 * @param {Promise<T>} promise
 * @param {number} ms
 * @param {string} label
 * @returns {Promise<T>}
 */
export function withTimeout(promise, ms, label) {
  /** @type {ReturnType<typeof setTimeout> | undefined} */
  let timer
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
  })
  return /** @type {Promise<T>} */ (Promise.race([promise, timeout]).finally(() => clearTimeout(timer)))
}

/** @param {unknown} value */
export function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

/**
 * Antwort der API: für alle Fälle gleich aufgebaut (nur die Bestätigung aus den eigenen Angaben).
 * @param {Receipt} receipt
 * @returns {PublicResult}
 */
export function publicResult(receipt) {
  return { ok: true, receipt }
}

// ---------------------------------------------------------------------------
// Empfänger
// ---------------------------------------------------------------------------

/**
 * Hinterlegte Adressen der übergebenen Abos, klein geschrieben, ohne Doppelte.
 * @param {SubscriptionFacts[]} subscriptions
 * @returns {string[]}
 */
export function contractEmailsOf(subscriptions) {
  /** @type {string[]} */
  const emails = []
  for (const subscription of subscriptions) {
    for (const email of subscription.contactEmails ?? []) {
      const normalized = normalizeEmail(email)
      if (normalized && !emails.includes(normalized)) emails.push(normalized)
    }
  }
  return emails
}

/**
 * Hinterlegte Adressen des Vertrags, den die Kündigung betrifft. Ohne passendes laufendes Abo
 * (PayPal, nichts gefunden) gibt es keine.
 * @param {CancellationDecision} decision
 * @param {SubscriptionFacts[]} subscriptions
 * @param {string} contract
 * @param {PriceConfig} priceConfig
 */
export function cancellationContractEmails(decision, subscriptions, contract, priceConfig) {
  const relevant = decision.subscriptionId
    ? subscriptions.filter((subscription) => subscription.id === decision.subscriptionId)
    : openSubscriptionsFor(subscriptions, contract, priceConfig)
  return contractEmailsOf(relevant)
}

/**
 * Hinterlegte Adressen des Vertrags, den der Widerruf betrifft (auch schon beendete Abos).
 * @param {SubscriptionFacts[]} subscriptions
 * @param {string} contract
 * @param {PriceConfig} priceConfig
 */
export function withdrawalContractEmails(subscriptions, contract, priceConfig) {
  return contractEmailsOf(subscriptions.filter((subscription) => subscriptionMatchesContract(subscription, contract, priceConfig)))
}

/**
 * Abweichende Bestätigungsadresse: Sie bekommt immer nur die neutrale Eingangsbestätigung, und zwar
 * vor der Suche bei Stripe. So hängt weder Inhalt noch Zeitpunkt dieser E-Mail davon ab, ob zur
 * Kontoadresse ein Vertrag existiert.
 * @param {{ accountEmail: string, confirmationEmail?: string | null }} input
 * @returns {string | null}
 */
export function earlyNeutralRecipient({ accountEmail, confirmationEmail }) {
  const account = normalizeEmail(accountEmail)
  const confirmation = normalizeEmail(confirmationEmail)
  return confirmation && confirmation !== account ? confirmation : null
}

/**
 * Wer bekommt welche E-Mail? Vergleich exakt (nur Groß- und Kleinschreibung egal).
 * - full: vollständige Bestätigung, nur an eine hinterlegte Adresse. Bevorzugt die Kontoadresse,
 *   sonst die erste hinterlegte.
 * - neutral: neutrale Eingangsbestätigung. An eine abweichende Bestätigungsadresse immer (siehe
 *   earlyNeutralRecipient), sonst an die Kontoadresse, wenn sie nicht hinterlegt ist.
 * @param {{ accountEmail: string, confirmationEmail?: string | null, contractEmails: string[] }} input
 * @returns {{ full: string | null, neutral: string | null }}
 */
export function decideRecipients({ accountEmail, confirmationEmail, contractEmails }) {
  const stored = contractEmails.map(normalizeEmail).filter(Boolean)
  const account = normalizeEmail(accountEmail)
  const early = earlyNeutralRecipient({ accountEmail, confirmationEmail })

  const full = stored.length === 0 ? null : stored.includes(account) ? account : stored[0]
  const neutral = early ?? (account && !stored.includes(account) ? account : null)
  return { full, neutral }
}

// ---------------------------------------------------------------------------
// Dauerhaftes Limit
// ---------------------------------------------------------------------------

/**
 * @typedef {{
 *   limited: boolean,
 *   reasons: Array<'email' | 'ip'>,
 *   notify: boolean,
 *   dailyCap: boolean,
 *   dailyCapStarted: boolean,
 * }} LimitResult
 */

/**
 * @param {RecentCounts | null} counts Anzahl der Erklärungen im Zeitfenster bis einschließlich der
 *   aktuellen (Position). null: unbekannt (DB-Fehler), dann gilt nur das Speicher-Limit.
 * @param {{ maxPerEmail: number, maxPerIp: number, maxPerDay: number }} [limits]
 * @returns {LimitResult}
 *   limited/reasons: über dem Limit je Adresse bzw. IP, dann weder E-Mail noch Stripe.
 *   notify: nur beim ersten Überschreiten je Adresse bzw. IP, damit ein Angriff Telegram nicht flutet.
 *   dailyCap: über dem Tageslimit für alle Erklärungen, dann keine E-Mails an nicht hinterlegte
 *   Adressen. dailyCapStarted: genau beim Überschreiten, für eine einzige Meldung an Petar.
 */
export function evaluateLimits(counts, limits = LIMITS) {
  /** @type {Array<'email' | 'ip'>} */
  const reasons = []
  let notify = false
  if (!counts) return { limited: false, reasons, notify, dailyCap: false, dailyCapStarted: false }

  for (const count of counts.emailCounts) {
    if (count > limits.maxPerEmail) {
      if (!reasons.includes('email')) reasons.push('email')
      if (count === limits.maxPerEmail + 1) notify = true
    }
  }
  if (counts.ipCount != null && counts.ipCount > limits.maxPerIp) {
    reasons.push('ip')
    if (counts.ipCount === limits.maxPerIp + 1) notify = true
  }
  const total = counts.totalCount ?? null
  const dailyCap = total != null && total > limits.maxPerDay
  const dailyCapStarted = dailyCap && total === limits.maxPerDay + 1
  return { limited: reasons.length > 0, reasons, notify, dailyCap, dailyCapStarted }
}

/** @param {Array<'email' | 'ip'>} reasons */
function describeLimitReasons(reasons) {
  return reasons
    .map((reason) =>
      reason === 'email'
        ? `mehr als ${LIMITS.maxPerEmail} Erklärungen zu einer E-Mail-Adresse in 24 Stunden`
        : `mehr als ${LIMITS.maxPerIp} Erklärungen von einer IP-Adresse in 24 Stunden`
    )
    .join(' und ')
}

/**
 * @param {string[]} emails
 * @param {{ id: string, receivedAt: Date, saved: boolean, ipHash: string | null }} ctx
 * @param {DeclarationDeps} deps
 */
async function checkLimits(emails, ctx, deps) {
  const unique = Array.from(new Set(emails.map(normalizeEmail).filter(Boolean)))
  try {
    // Gezählt werden nur Erklärungen, die vor dieser eingegangen sind, plus diese selbst. So hat jede
    // Erklärung eine feste Position: Auch bei vielen gleichzeitigen Anfragen trifft genau eine das
    // erste Überschreiten (sonst könnten alle darüber liegen und die Meldung an Petar fiele aus).
    // Das gilt auch, wenn das Speichern fehlgeschlagen ist.
    const counts = await deps.countRecent({
      emails: unique,
      ipHash: ctx.ipHash,
      since: new Date(ctx.receivedAt.getTime() - LIMITS.windowMs),
      before: ctx.receivedAt,
    })
    const own = 1
    return evaluateLimits({
      emailCounts: counts.emailCounts.map((count) => count + own),
      ipCount: counts.ipCount == null ? null : counts.ipCount + own,
      totalCount: counts.totalCount == null ? null : counts.totalCount + own,
    })
  } catch (error) {
    ;(deps.log ?? console).error('[vertrag] Limit check failed, continuing with the in-memory limit only:', ctx.id, error)
    return evaluateLimits(null)
  }
}

/**
 * @param {string} label
 * @param {{ id: string, receivedAt: Date, saved: boolean }} ctx
 * @param {LimitResult} limit
 * @param {DeclarationDeps} deps
 */
async function handleLimited(label, ctx, limit, deps) {
  const lines = [
    `${label} eingegangen: ${ctx.id}`,
    `Status: ${STATUS_NOTE_TEXT.limit}`,
    `Grund: ${describeLimitReasons(limit.reasons)}`,
    'Handlung nötig: ja',
    'Weitere Eingänge über dem Limit meldet Telegram in den nächsten 24 Stunden nicht einzeln, sie stehen auf der Owner-Seite.',
  ]
  if (limit.dailyCapStarted) lines.push(dailyCapLine())
  if (!ctx.saved) lines.push(SAVE_FAILED)

  const notify = limit.notify || limit.dailyCapStarted || !ctx.saved
  if (!notify) (deps.log ?? console).warn('[vertrag] Declaration over limit, no mail sent:', ctx.id, limit.reasons.join(','))

  await Promise.all([
    ctx.saved
      ? deps.updateDeclaration(ctx.id, {
          status: 'manual',
          statusNote: STATUS_NOTE_TEXT.limit,
          mailNote: 'keine Mail versendet (Limit erreicht)',
        })
      : Promise.resolve(),
    notify ? deps.notify(lines) : Promise.resolve(),
    purge(ctx, deps),
  ])
}

/**
 * @param {{ receivedAt: Date }} ctx
 * @param {DeclarationDeps} deps
 */
async function purge(ctx, deps) {
  if (!deps.purgeIpHashes) return
  try {
    await deps.purgeIpHashes(new Date(ctx.receivedAt.getTime() - IP_HASH_RETENTION_MS))
  } catch (error) {
    ;(deps.log ?? console).error('[vertrag] Purging old IP hashes failed (non-fatal):', error)
  }
}

// ---------------------------------------------------------------------------
// E-Mails und Meldung an Petar
// ---------------------------------------------------------------------------

/**
 * sendMail, das nie wirft (ein Fehler zählt als nicht versendet).
 * @param {DeclarationDeps} deps
 * @param {string} to
 * @param {Mail} mail
 * @param {{ tag: string, bcc: boolean }} options
 * @returns {Promise<boolean>}
 */
function safeSend(deps, to, mail, options) {
  return deps.sendMail(to, mail, options).catch((error) => {
    ;(deps.log ?? console).error('[vertrag] Sending mail failed:', options.tag, error)
    return false
  })
}

/**
 * @param {{
 *   recipients: { full: string | null, neutral: string | null },
 *   full: Mail,
 *   neutral: Mail,
 *   internal: Mail,
 *   tag: string,
 *   dailyCap: boolean,
 *   earlyNeutral?: Promise<boolean> | null,
 * }} input earlyNeutral: schon vor der Stripe-Suche gestartete neutrale E-Mail an recipients.neutral.
 * @param {DeclarationDeps} deps
 */
async function sendMails({ recipients, full, neutral, internal, tag, dailyCap, earlyNeutral }, deps) {
  const [fullSent, neutralSent, internalSent] = await Promise.all([
    recipients.full ? safeSend(deps, recipients.full, full, { tag, bcc: true }) : Promise.resolve(false),
    earlyNeutral ??
      (recipients.neutral && !dailyCap
        ? safeSend(deps, recipients.neutral, neutral, { tag: `${tag}-eingang`, bcc: false })
        : Promise.resolve(false)),
    // Ohne hinterlegte Adresse bekommt Petar die vollständige Fassung zur manuellen Bearbeitung.
    !recipients.full && !dailyCap && deps.internalCopyEmail
      ? safeSend(deps, deps.internalCopyEmail, internal, { tag: `${tag}-intern`, bcc: false })
      : Promise.resolve(false),
  ])
  return { fullSent, neutralSent, internalSent }
}

/**
 * Kurzbeschreibung für Owner-Seite und Telegram, ohne Adressen.
 * @param {{ full: string | null, neutral: string | null }} recipients
 * @param {{ fullSent: boolean, neutralSent: boolean }} sent
 * @param {{ dailyCap?: boolean }} [options]
 */
export function describeMails(recipients, sent, options = {}) {
  const parts = []
  if (recipients.full) {
    parts.push(sent.fullSent ? 'vollständige Bestätigung an hinterlegte Adresse versendet' : 'vollständige Bestätigung an hinterlegte Adresse fehlgeschlagen')
  } else {
    parts.push('keine hinterlegte Adresse gefunden, vollständige Bestätigung steht aus')
  }
  if (recipients.neutral) {
    if (options.dailyCap) parts.push('neutrale Eingangsbestätigung nicht versendet (Tageslimit erreicht)')
    else parts.push(sent.neutralSent ? 'neutrale Eingangsbestätigung an angegebene Adresse versendet' : 'neutrale Eingangsbestätigung fehlgeschlagen')
  }
  return parts.join('; ')
}

function dailyCapLine() {
  return `Tageslimit erreicht: mehr als ${LIMITS.maxPerDay} Erklärungen in 24 Stunden. Bis es wieder darunter liegt, gehen keine Mails an nicht hinterlegte Adressen und keine internen Kopien raus, und Telegram meldet nur noch Eingänge mit gefundenem Vertrag. Bitte die Owner-Seite prüfen.`
}

/**
 * Telegram-Meldung nach der Bearbeitung. Über dem Tageslimit nur noch beim Überschreiten (eine
 * Meldung), bei gefundenem Vertrag und wenn die DB ausgefallen ist, sonst würde ein Angriff über
 * wechselnde IPs den Chat fluten.
 * @param {string[]} lines
 * @param {{ saved: boolean }} ctx
 * @param {LimitResult} limit
 * @param {boolean} contractFound
 * @param {DeclarationDeps} deps
 */
function notifyAfterProcessing(lines, ctx, limit, contractFound, deps) {
  if (!limit.dailyCap) return deps.notify(lines)
  if (limit.dailyCapStarted) return deps.notify([...lines, dailyCapLine()])
  if (contractFound || !ctx.saved) return deps.notify(lines)
  ;(deps.log ?? console).warn('[vertrag] Daily cap reached, no notification for', lines[0])
  return Promise.resolve()
}

/** @param {CancellationDecision['action']} action */
function statusFor(action) {
  return action === 'schedule' ? 'scheduled' : action
}

/** @param {CancellationDecision} decision */
function statusNote(decision) {
  const text = STATUS_NOTE_TEXT[/** @type {keyof typeof STATUS_NOTE_TEXT} */ (decision.reason)] ?? decision.reason
  return decision.action !== 'manual' && decision.needsReview ? `${text}; außerordentliche Kündigung prüfen` : text
}

// ---------------------------------------------------------------------------
// Kündigung
// ---------------------------------------------------------------------------

/**
 * @param {KuendigungData} data
 * @param {{ ipHash: string | null }} meta
 * @param {DeclarationDeps} deps
 * @returns {Promise<Accepted>}
 */
export async function acceptKuendigung(data, meta, deps) {
  const receivedAt = deps.now()
  const id = createDeclarationId('kuendigung', receivedAt, deps.randomBytes(6))
  const receipt = buildCancellationReceipt({ id, receivedAt, data })

  const saved = await deps.saveDeclaration({
    id,
    type: 'kuendigung',
    name: data.name,
    email: data.accountEmail,
    confirmationEmail: data.confirmationEmail,
    contract: data.contract,
    kind: data.kind,
    reason: data.reason,
    timing: data.timing,
    requestedDate: data.requestedDate ? new Date(`${data.requestedDate}T00:00:00Z`) : null,
    receivedAt,
    status: 'received',
    ipHash: meta.ipHash,
  })

  const ctx = { id, receivedAt, receipt, saved, ipHash: meta.ipHash }
  return { body: publicResult(receipt), background: () => finishKuendigung(ctx, data, deps) }
}

/**
 * Hinterlegte Adressen eines PayPal-Vertrags (aus der PayPal-Liste). Fehler zählen als "nichts gefunden".
 * @param {string} email
 * @param {DeclarationDeps} deps
 * @param {string} id
 */
async function payPalContacts(email, deps, id) {
  if (!deps.findPayPalContacts) return []
  try {
    return await withTimeout(deps.findPayPalContacts(email), deps.stripeBudgetMs ?? STRIPE_BUDGET_MS, 'PayPal lookup')
  } catch (error) {
    ;(deps.log ?? console).error('[vertrag] PayPal lookup failed:', id, error)
    return []
  }
}

/**
 * @param {{ id: string, receivedAt: Date, receipt: Receipt, saved: boolean, ipHash: string | null }} ctx
 * @param {KuendigungData} data
 * @param {DeclarationDeps} deps
 */
async function finishKuendigung(ctx, data, deps) {
  const log = deps.log ?? console
  const tag = 'vertrag-kuendigung'
  const limit = await checkLimits([data.accountEmail, data.confirmationEmail], ctx, deps)
  if (limit.limited) return handleLimited('Kündigung', ctx, limit, deps)

  /** @param {string | null} recipientEmail */
  const neutralMail = (recipientEmail) =>
    buildNeutralEmail({
      type: 'kuendigung',
      id: ctx.id,
      receivedAt: ctx.receivedAt,
      name: data.name,
      contract: data.contract,
      kind: data.kind,
      timing: data.timing,
      requestedDate: data.requestedDate,
      recipientEmail,
    })

  // Abweichende Bestätigungsadresse: neutrale E-Mail sofort, noch vor Stripe (Zeitpunkt unabhängig
  // von einer Mitgliedschaft). Ergebnis wird unten zusammen mit den übrigen E-Mails abgewartet.
  const early = earlyNeutralRecipient(data)
  const earlyNeutral =
    early && !limit.dailyCap ? safeSend(deps, early, neutralMail(early), { tag: `${tag}-eingang`, bcc: false }) : null

  /** @param {SubscriptionFacts[]} subscriptions */
  const decide = (subscriptions) =>
    decideCancellation({
      subscriptions,
      contract: data.contract,
      kind: data.kind,
      timing: data.timing,
      requestedDate: data.requestedDate,
      priceConfig: deps.priceConfig,
      now: ctx.receivedAt,
    })

  /** @type {SubscriptionFacts[]} */
  let subscriptions = []
  /** @type {string[]} */
  let payPalEmails = []
  /** @type {CancellationDecision} */
  let decision
  if (data.contract === 'mentorship_paypal') {
    // PayPal-Altverträge: keine Automatik, Petar kündigt in PayPal. Die PayPal-Liste sagt nur, an
    // welche Adresse die vollständige Bestätigung gehen darf.
    decision = decide([])
    payPalEmails = await payPalContacts(data.accountEmail, deps, ctx.id)
  } else {
    /** @type {string | null} */
    let subscriptionId = null
    let expired = false
    try {
      // Eine Zeitgrenze für Suche und Kündigung zusammen. Nach Ablauf wird nichts mehr in Stripe
      // geändert (expired). Läuft sie ab, während Stripe die Kündigung schon annimmt, landet der Fall
      // als stripe_error bei Petar und wird dort geprüft.
      decision = await withTimeout(
        (async () => {
          subscriptions = await deps.findSubscriptions(data.accountEmail, data.contract, 'open')
          const decided = decide(subscriptions)
          subscriptionId = decided.subscriptionId
          if (expired || decided.action !== 'schedule' || !decided.subscriptionId) return decided
          const endsAt = await deps.scheduleCancellation(decided.subscriptionId, ctx.id)
          return { ...decided, endsAt: endsAt ?? decided.endsAt }
        })(),
        deps.stripeBudgetMs ?? STRIPE_BUDGET_MS,
        'Stripe handling'
      )
    } catch (error) {
      expired = true
      log.error('[vertrag] Stripe handling failed:', ctx.id, error)
      decision = { action: 'manual', reason: 'stripe_error', subscriptionId, endsAt: null, needsReview: true }
    }
  }

  const recipients = decideRecipients({
    accountEmail: data.accountEmail,
    confirmationEmail: data.confirmationEmail,
    contractEmails:
      data.contract === 'mentorship_paypal'
        ? payPalEmails
        : cancellationContractEmails(decision, subscriptions, data.contract, deps.priceConfig),
  })
  const outcome = describeCancellationOutcome({ data, decision })
  const sent = await sendMails(
    {
      recipients,
      full: buildConfirmationEmail(ctx.receipt, { outcome }),
      internal: buildConfirmationEmail(ctx.receipt, { outcome, internal: true }),
      neutral: neutralMail(recipients.neutral),
      tag,
      dailyCap: limit.dailyCap,
      earlyNeutral,
    },
    deps
  )
  const mailNote = describeMails(recipients, sent, { dailyCap: limit.dailyCap })

  const lines = [`Kündigung eingegangen: ${ctx.id}`, `Status: ${statusNote(decision)}`, `Mail: ${mailNote}`]
  if (decision.action === 'manual' || decision.needsReview || !sent.fullSent) lines.push('Handlung nötig: ja')
  if (!sent.fullSent) lines.push('Achtung: Bestätigung mit Vertragsende nicht versendet, bitte selbst an die hinterlegte Adresse senden.')
  if (!ctx.saved) lines.push(SAVE_FAILED)

  await Promise.all([
    ctx.saved
      ? deps.updateDeclaration(ctx.id, {
          status: statusFor(decision.action),
          statusNote: statusNote(decision),
          stripeSubscriptionId: decision.subscriptionId,
          endsAt: decision.endsAt,
          confirmationSentAt: sent.fullSent ? deps.now() : null,
          mailNote,
        })
      : Promise.resolve(),
    notifyAfterProcessing(lines, ctx, limit, Boolean(recipients.full), deps),
    purge(ctx, deps),
  ])
}

// ---------------------------------------------------------------------------
// Widerruf
// ---------------------------------------------------------------------------

/**
 * @param {WiderrufData} data
 * @param {{ ipHash: string | null }} meta
 * @param {DeclarationDeps} deps
 * @returns {Promise<Accepted>}
 */
export async function acceptWiderruf(data, meta, deps) {
  const receivedAt = deps.now()
  const id = createDeclarationId('widerruf', receivedAt, deps.randomBytes(6))
  const receipt = buildWithdrawalReceipt({ id, receivedAt, data })

  const saved = await deps.saveDeclaration({
    id,
    type: 'widerruf',
    name: data.name,
    email: data.email,
    confirmationEmail: data.email,
    contract: data.contract,
    details: data.details,
    receivedAt,
    status: 'received',
    statusNote: STATUS_NOTE_TEXT.withdrawal,
    ipHash: meta.ipHash,
  })

  const ctx = { id, receivedAt, receipt, saved, ipHash: meta.ipHash }
  return { body: publicResult(receipt), background: () => finishWiderruf(ctx, data, deps) }
}

/**
 * Widerruf: nur erfassen, bestätigen, melden. Beenden, Erstattung und Wertersatz macht Petar.
 * Stripe (bzw. die PayPal-Liste) wird nur gelesen, um zu prüfen, ob die Adresse zum Vertrag
 * hinterlegt ist.
 * @param {{ id: string, receivedAt: Date, receipt: Receipt, saved: boolean, ipHash: string | null }} ctx
 * @param {WiderrufData} data
 * @param {DeclarationDeps} deps
 */
async function finishWiderruf(ctx, data, deps) {
  const log = deps.log ?? console
  const limit = await checkLimits([data.email], ctx, deps)
  if (limit.limited) return handleLimited('Widerruf', ctx, limit, deps)

  /** @type {string[]} */
  let contractEmails = []
  if (data.contract === 'mentorship_paypal') {
    contractEmails = await payPalContacts(data.email, deps, ctx.id)
  } else {
    try {
      const subscriptions = await withTimeout(
        deps.findSubscriptions(data.email, data.contract, 'any'),
        deps.stripeBudgetMs ?? STRIPE_BUDGET_MS,
        'Stripe lookup'
      )
      contractEmails = withdrawalContractEmails(subscriptions, data.contract, deps.priceConfig)
    } catch (error) {
      log.error('[vertrag] Stripe lookup for withdrawal failed:', ctx.id, error)
    }
  }

  const recipients = decideRecipients({ accountEmail: data.email, confirmationEmail: data.email, contractEmails })
  const sent = await sendMails(
    {
      recipients,
      full: buildConfirmationEmail(ctx.receipt, { outcome: WITHDRAWAL_OUTCOME }),
      internal: buildConfirmationEmail(ctx.receipt, { outcome: WITHDRAWAL_OUTCOME, internal: true }),
      neutral: buildNeutralEmail({
        type: 'widerruf',
        id: ctx.id,
        receivedAt: ctx.receivedAt,
        name: data.name,
        contract: data.contract,
        recipientEmail: recipients.neutral,
      }),
      tag: 'vertrag-widerruf',
      dailyCap: limit.dailyCap,
    },
    deps
  )
  const mailNote = describeMails(recipients, sent, { dailyCap: limit.dailyCap })

  const lines = [
    `Widerruf eingegangen: ${ctx.id}`,
    `Status: ${STATUS_NOTE_TEXT.withdrawal}`,
    `Mail: ${mailNote}`,
    'Handlung nötig: ja',
  ]
  if (!sent.fullSent && !sent.neutralSent) lines.push('Achtung: keine Eingangsbestätigung versendet, bitte selbst bestätigen.')
  if (!ctx.saved) lines.push(SAVE_FAILED)

  await Promise.all([
    ctx.saved ? deps.updateDeclaration(ctx.id, { confirmationSentAt: sent.fullSent ? deps.now() : null, mailNote }) : Promise.resolve(),
    notifyAfterProcessing(lines, ctx, limit, Boolean(recipients.full), deps),
    purge(ctx, deps),
  ])
}
