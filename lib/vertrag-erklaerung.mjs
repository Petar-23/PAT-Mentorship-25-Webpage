// Reine Funktionen für Kündigungen (§ 312k BGB) und Widerrufe (§ 356a BGB).
// Keine Netz- oder DB-Zugriffe: Seiten, API-Routen, E-Mail und Tests nutzen dieselben Texte.
// Der Ablauf (wer bekommt welche E-Mail, Limits) steht in lib/vertrag-ablauf.mjs.
//
// ANWALTLICH PRÜFEN: Wortlaut der Bestätigungen und der Ablauf (was automatisch passiert,
// was manuell bearbeitet wird) sind ein Entwurf und müssen vor dem Livegang von einem
// Anwalt für IT- und Wettbewerbsrecht freigegeben werden.

export const CONTACT_EMAIL = 'kontakt@price-action-trader.de'
export const COMPANY_LINES = Object.freeze([
  'Maric Capital GmbH',
  'Karolinenstraße 13',
  '64342 Seeheim-Jugenheim',
])
export const SITE_HOST = 'www.price-action-trader.de'

// Gesetzlich vorgegebene Beschriftungen. Nicht ändern ohne Rücksprache mit dem Anwalt.
export const LABELS = Object.freeze({
  cancelEntry: 'Verträge hier kündigen', // § 312k Abs. 2 Satz 2 BGB
  cancelConfirm: 'jetzt kündigen', // § 312k Abs. 2 Satz 3 Nr. 2 BGB
  withdrawEntry: 'Vertrag widerrufen', // § 356a Abs. 1 Satz 2 BGB
  withdrawConfirm: 'Widerruf bestätigen', // § 356a Abs. 3 Satz 2 BGB
})

export const CONTRACT_OPTIONS = Object.freeze([
  Object.freeze({ value: 'mentorship_stripe', label: 'PAT Mentorship (Zahlung per Karte oder SEPA-Lastschrift über Stripe)' }),
  Object.freeze({ value: 'mentorship_paypal', label: 'PAT Mentorship (Zahlung über PayPal, älterer Vertrag)' }),
  Object.freeze({ value: 'raidmap', label: 'PAT Raid Map (TradingView-Indikator)' }),
])
export const CONTRACT_VALUES = Object.freeze(CONTRACT_OPTIONS.map((option) => option.value))

export const KIND_OPTIONS = Object.freeze([
  Object.freeze({ value: 'ordentlich', label: 'Ordentliche Kündigung' }),
  Object.freeze({ value: 'ausserordentlich', label: 'Außerordentliche Kündigung (aus wichtigem Grund)' }),
])

export const TIMING_OPTIONS = Object.freeze([
  Object.freeze({ value: 'naechstmoeglich', label: 'Zum nächstmöglichen Zeitpunkt' }),
  Object.freeze({ value: 'datum', label: 'Zu einem bestimmten Datum' }),
])

// Klartext für Petar (Owner-Seite, Telegram). Keine personenbezogenen Daten.
export const STATUS_NOTE_TEXT = Object.freeze({
  period_end: 'Stripe-Abo zum Periodenende gekündigt (umkehrbar)',
  cancel_at_period_end: 'Stripe-Abo war bereits zum Periodenende gekündigt',
  cancel_at: 'Stripe-Abo hatte bereits ein Enddatum',
  paypal: 'PayPal-Vertrag, bitte in PayPal kündigen',
  no_subscription: 'kein passendes laufendes Stripe-Abo zur E-Mail gefunden',
  multiple_subscriptions: 'mehrere passende Stripe-Abos gefunden',
  no_period_end: 'Stripe-Abo ohne Periodenende',
  period_end_passed: 'Periodenende des Stripe-Abos liegt in der Vergangenheit, bitte in Stripe prüfen',
  requested_date_after_period_end: 'Wunschdatum liegt nach dem Periodenende, Enddatum in Stripe setzen',
  cancel_at_after_period_end: 'geplantes Enddatum liegt nach dem Periodenende',
  stripe_error: 'Fehler bei Stripe, bitte in Stripe prüfen',
  withdrawal: 'Widerruf: Beenden, Erstattung und Wertersatz manuell',
  limit: 'Limit erreicht: nicht automatisch bearbeitet, keine Mail versendet, bitte prüfen und selbst bestätigen',
})

// Diese Stripe-Status lassen sich per cancel_at_period_end kündigen.
export const CANCELLABLE_STATUSES = Object.freeze(['active', 'trialing', 'past_due', 'unpaid'])

/** @param {string} value */
export function contractLabel(value) {
  return CONTRACT_OPTIONS.find((option) => option.value === value)?.label ?? value
}

/** @param {string} value */
export function kindLabel(value) {
  return KIND_OPTIONS.find((option) => option.value === value)?.label ?? value
}

// ---------------------------------------------------------------------------
// Datum und Uhrzeit (immer deutsche Zeit)
// ---------------------------------------------------------------------------

const BERLIN = 'Europe/Berlin'

/**
 * Kalendertag in deutscher Zeit als YYYY-MM-DD.
 * @param {Date} date
 * @returns {string}
 */
export function berlinDateKey(date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: BERLIN,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const get = (type) => parts.find((part) => part.type === type)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')}`
}

/**
 * @param {string} key YYYY-MM-DD
 * @returns {string} TT.MM.JJJJ
 */
export function formatDateKey(key) {
  const [year, month, day] = key.split('-')
  return `${day}.${month}.${year}`
}

/**
 * @param {Date} date
 * @returns {string} TT.MM.JJJJ in deutscher Zeit
 */
export function formatBerlinDate(date) {
  return formatDateKey(berlinDateKey(date))
}

/**
 * @param {Date} date
 * @returns {string} z. B. "25.09.2026 um 14:03:12 Uhr (MESZ)"
 */
export function formatBerlinDateTime(date) {
  const parts = new Intl.DateTimeFormat('de-DE', {
    timeZone: BERLIN,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
    timeZoneName: 'short',
  }).formatToParts(date)
  const get = (type) => parts.find((part) => part.type === type)?.value ?? ''
  return `${get('day')}.${get('month')}.${get('year')} um ${get('hour')}:${get('minute')}:${get('second')} Uhr (${get('timeZoneName')})`
}

/**
 * Prüft ein Datum im Format YYYY-MM-DD auf Gültigkeit (keine 31.02.).
 * @param {string} value
 */
export function isValidDateKey(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

// ---------------------------------------------------------------------------
// Eingangs-ID, z. B. K-260925-7F3KQ9 (Kündigung) oder W-260925-... (Widerruf)
// ---------------------------------------------------------------------------

const ID_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ' // Crockford Base32, ohne I, L, O, U

/**
 * @param {'kuendigung' | 'widerruf'} type
 * @param {Date} now
 * @param {Uint8Array} randomBytes mindestens 6 Bytes
 */
export function createDeclarationId(type, now, randomBytes) {
  const prefix = type === 'widerruf' ? 'W' : 'K'
  const day = berlinDateKey(now).slice(2).replace(/-/g, '')
  let suffix = ''
  for (let i = 0; i < 6; i++) suffix += ID_ALPHABET[randomBytes[i] % 32]
  return `${prefix}-${day}-${suffix}`
}

// ---------------------------------------------------------------------------
// Stripe: Suche und Entscheidung "welches Abo, welches Enddatum"
// ---------------------------------------------------------------------------

/**
 * Maskiert einen Wert für die Stripe Search Query Language (in einfachen Anführungszeichen).
 * @param {string} value
 */
export function escapeStripeSearchValue(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}

/**
 * Vergleicht zwei E-Mail-Adressen ohne Rücksicht auf Groß- und Kleinschreibung.
 * Nötig, weil die Stripe-Suche `email:'…'` auch Kunden liefert, deren Adresse die Wörter der
 * Suchanfrage nur enthält (Feldtyp "string"). Gekündigt wird nur bei exakt gleicher Adresse.
 * @param {string | null | undefined} a
 * @param {string | null | undefined} b
 */
export function sameEmail(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false
  const left = a.trim().toLowerCase()
  return left.length > 0 && left === b.trim().toLowerCase()
}

/**
 * @param {string | undefined | null} value komma-getrennte IDs
 * @returns {string[]}
 */
export function parseIdList(value) {
  if (!value) return []
  return value
    .split(',')
    .map((id) => id.trim())
    .filter((id) => id.length > 0)
}

/**
 * @typedef {{
 *   id: string,
 *   status: string,
 *   cancelAtPeriodEnd: boolean,
 *   cancelAt: number | null,
 *   currentPeriodEnd: number | null,
 *   created: number,
 *   product: string | null,
 *   priceIds: string[],
 *   contactEmails?: string[],
 * }} SubscriptionFacts
 * contactEmails: Adressen, die bei Stripe (Kunde) oder Clerk (bestätigte Adresse des Kontos) zu
 * diesem Abo hinterlegt sind, klein geschrieben. Nur an diese geht die vollständige Bestätigung.
 *
 * @typedef {{ mentorshipPriceIds: string[], raidmapPriceIds: string[] }} PriceConfig
 */

/**
 * Gehört das Abo zum ausgewählten Vertrag?
 * Mentorship nur bei bekannter Preis-ID (STRIPE_ACCESS_PRICE_IDS bzw. STRIPE_PRICE_ID), damit wir
 * nie ein fremdes Produkt kündigen. Raid Map über Preis-ID oder metadata.product = raidmap.
 * @param {SubscriptionFacts} subscription
 * @param {string} contract
 * @param {PriceConfig} priceConfig
 */
export function subscriptionMatchesContract(subscription, contract, priceConfig) {
  const priceIds = subscription.priceIds ?? []
  const isRaidmap =
    subscription.product === 'raidmap' ||
    priceIds.some((id) => priceConfig.raidmapPriceIds.includes(id))

  if (contract === 'raidmap') return isRaidmap
  if (contract === 'mentorship_stripe') {
    if (isRaidmap) return false
    return priceIds.some((id) => priceConfig.mentorshipPriceIds.includes(id))
  }
  return false
}

/**
 * Laufende (kündbare) Abos, die zum gewählten Vertrag gehören.
 * @param {SubscriptionFacts[]} subscriptions
 * @param {string} contract
 * @param {PriceConfig} priceConfig
 */
export function openSubscriptionsFor(subscriptions, contract, priceConfig) {
  return subscriptions.filter(
    (subscription) =>
      subscriptionMatchesContract(subscription, contract, priceConfig) &&
      CANCELLABLE_STATUSES.includes(subscription.status)
  )
}

/**
 * @typedef {{
 *   action: 'schedule' | 'already_scheduled' | 'manual',
 *   reason: string,
 *   subscriptionId: string | null,
 *   endsAt: Date | null,
 *   needsReview: boolean,
 * }} CancellationDecision
 */

/**
 * Entscheidet, was mit einer Kündigung passiert.
 * - schedule: genau ein passendes laufendes Abo, Stripe setzt cancel_at_period_end (umkehrbar),
 *   Vertragsende = current_period_end.
 * - already_scheduled: Das Abo ist schon gekündigt, es bleibt beim vorhandenen Enddatum.
 * - manual: PayPal, nichts gefunden, mehrere Treffer, Periodenende fehlt oder liegt in der
 *   Vergangenheit, Wunschdatum nach dem Periodenende.
 * Außerordentliche Kündigungen werden zusätzlich zur Prüfung markiert (needsReview): Wir merken
 * sie mindestens zum Periodenende vor, ob sie sofort wirkt, entscheidet Petar.
 *
 * @param {{
 *   subscriptions: SubscriptionFacts[],
 *   contract: string,
 *   kind: 'ordentlich' | 'ausserordentlich',
 *   timing: 'naechstmoeglich' | 'datum',
 *   requestedDate: string | null,
 *   priceConfig: PriceConfig,
 *   now?: Date,
 * }} input
 * @returns {CancellationDecision}
 */
export function decideCancellation(input) {
  const needsReview = input.kind === 'ausserordentlich'
  const manual = (reason, subscriptionId = null) => ({
    action: /** @type {const} */ ('manual'),
    reason,
    subscriptionId,
    endsAt: null,
    needsReview: true,
  })

  if (input.contract === 'mentorship_paypal') return manual('paypal')

  const open = openSubscriptionsFor(input.subscriptions, input.contract, input.priceConfig)

  if (open.length === 0) return manual('no_subscription')
  if (open.length > 1) return manual('multiple_subscriptions')

  const subscription = open[0]
  if (!subscription.currentPeriodEnd) return manual('no_period_end', subscription.id)
  const periodEnd = new Date(subscription.currentPeriodEnd * 1000)
  // Z. B. "unpaid" mit abgelaufener Periode: kein sinnvolles Vertragsende, Petar prüft.
  if (periodEnd.getTime() <= (input.now ?? new Date()).getTime()) return manual('period_end_passed', subscription.id)

  if (input.timing === 'datum' && input.requestedDate && input.requestedDate > berlinDateKey(periodEnd)) {
    // Später als das nächstmögliche Ende: Stripe würde bei cancel_at anteilig abrechnen.
    // Das stellt Petar per Hand ein.
    return manual('requested_date_after_period_end', subscription.id)
  }

  if (subscription.cancelAtPeriodEnd) {
    return { action: 'already_scheduled', reason: 'cancel_at_period_end', subscriptionId: subscription.id, endsAt: periodEnd, needsReview }
  }

  if (subscription.cancelAt != null) {
    const cancelAt = new Date(subscription.cancelAt * 1000)
    if (cancelAt.getTime() <= periodEnd.getTime()) {
      return { action: 'already_scheduled', reason: 'cancel_at', subscriptionId: subscription.id, endsAt: cancelAt, needsReview }
    }
    return manual('cancel_at_after_period_end', subscription.id)
  }

  return { action: 'schedule', reason: 'period_end', subscriptionId: subscription.id, endsAt: periodEnd, needsReview }
}

// ---------------------------------------------------------------------------
// Eingangsbestätigung auf der Seite (und als Datei zum Speichern)
// ---------------------------------------------------------------------------
//
// Datenschutz: Die Bestätigung auf der Seite und die API-Antwort sind für alle Fälle gleich
// aufgebaut, egal ob zur E-Mail-Adresse ein Vertrag gefunden wurde oder nicht. Sie enthalten nur
// die eigenen Angaben, Eingangs-ID, Datum und Uhrzeit des Eingangs und einen festen Hinweis.
// Vertragsende und Mitgliedsstatus stehen nur in der E-Mail an die hinterlegte Adresse.

/**
 * @typedef {{ label: string, value: string }} ReceiptLine
 * @typedef {{
 *   id: string,
 *   type: 'kuendigung' | 'widerruf',
 *   title: string,
 *   statement: string,
 *   submittedVia: string,
 *   receivedAt: string,
 *   receivedAtText: string,
 *   lines: ReceiptLine[],
 *   notice: string,
 * }} Receipt
 */

// ANWALTLICH PRÜFEN: fester Hinweis auf der Bestätigungsseite (§ 312k Abs. 3 und 4 BGB).
export const CANCELLATION_NOTICE =
  'Die Bestätigung mit dem Zeitpunkt, zu dem der Vertrag endet, senden wir an die E-Mail-Adresse, die zu Ihrem Vertrag hinterlegt ist.'
// ANWALTLICH PRÜFEN: fester Hinweis auf der Bestätigungsseite (§ 356a Abs. 4 BGB).
export const WITHDRAWAL_NOTICE =
  'Eine Eingangsbestätigung senden wir zusätzlich per E-Mail an die angegebene Adresse. Wie es weitergeht, teilen wir Ihnen gesondert per E-Mail mit.'
export const WITHDRAWAL_OUTCOME = 'Wir bearbeiten Ihren Widerruf und melden uns per E-Mail mit den nächsten Schritten.'

const CANCEL_STATEMENT = 'Hiermit kündige ich den unten genannten Vertrag.'
const WITHDRAW_STATEMENT = 'Hiermit widerrufe ich den unten genannten Vertrag.'
const CANCEL_SUBMITTED_VIA = `Abgegeben durch Betätigen der Schaltfläche „${LABELS.cancelConfirm}“ auf ${SITE_HOST}/kuendigen.`
const WITHDRAW_SUBMITTED_VIA = `Abgegeben durch Betätigen der Schaltfläche „${LABELS.withdrawConfirm}“ auf ${SITE_HOST}/widerrufen.`

/**
 * Gibt den gewünschten Zeitpunkt so wieder, wie der Kunde ihn gewählt hat.
 * @param {{ timing: string, requestedDate: string | null }} data
 */
export function describeRequestedEnd(data) {
  if (data.timing === 'datum' && data.requestedDate && isValidDateKey(data.requestedDate)) {
    return `zum ${formatDateKey(data.requestedDate)}`
  }
  return 'zum nächstmöglichen Zeitpunkt'
}

/**
 * @typedef {{
 *   kind: 'ordentlich' | 'ausserordentlich',
 *   reason: string | null,
 *   name: string,
 *   accountEmail: string,
 *   contract: string,
 *   timing: 'naechstmoeglich' | 'datum',
 *   requestedDate: string | null,
 *   confirmationEmail: string,
 * }} CancellationInput
 */

/**
 * Bestätigung für die Seite: nur die eigenen Angaben, kein Vertragsende, kein Status.
 * @param {{ id: string, receivedAt: Date, data: CancellationInput }} input
 * @returns {Receipt}
 */
export function buildCancellationReceipt({ id, receivedAt, data }) {
  const lines = [
    { label: 'Eingangs-ID', value: id },
    { label: 'Eingang', value: formatBerlinDateTime(receivedAt) },
    { label: 'Art der Kündigung', value: kindLabel(data.kind) },
  ]
  if (data.kind === 'ausserordentlich' && data.reason) lines.push({ label: 'Kündigungsgrund', value: data.reason })
  lines.push(
    { label: 'Name', value: data.name },
    { label: 'E-Mail-Adresse des Kontos', value: data.accountEmail },
    { label: 'Vertrag', value: contractLabel(data.contract) },
    { label: 'Gewünschtes Vertragsende', value: describeRequestedEnd(data) },
  )
  if (data.confirmationEmail && !sameEmail(data.confirmationEmail, data.accountEmail)) {
    lines.push({ label: 'Weitere E-Mail-Adresse für eine Eingangsbestätigung', value: data.confirmationEmail })
  }

  return {
    id,
    type: 'kuendigung',
    title: 'Eingangsbestätigung Ihrer Kündigung',
    statement: CANCEL_STATEMENT,
    submittedVia: CANCEL_SUBMITTED_VIA,
    receivedAt: receivedAt.toISOString(),
    receivedAtText: formatBerlinDateTime(receivedAt),
    lines,
    notice: CANCELLATION_NOTICE,
  }
}

/**
 * Ergebnis der Kündigung für die E-Mail an die hinterlegte Adresse (nie für die Seite).
 * @param {{
 *   data: { timing: string, requestedDate: string | null },
 *   decision: { action: 'schedule' | 'already_scheduled' | 'manual', endsAt: Date | null, needsReview: boolean },
 * }} input
 */
export function describeCancellationOutcome({ data, decision }) {
  const endsAtText = decision.endsAt ? formatBerlinDate(decision.endsAt) : null
  const wishBeforeEnd = Boolean(
    data.timing === 'datum' && data.requestedDate && decision.endsAt && data.requestedDate < berlinDateKey(decision.endsAt)
  )
  if (decision.action === 'manual' || !endsAtText) {
    return 'Wir bearbeiten Ihre Kündigung und teilen Ihnen das Vertragsende gesondert per E-Mail mit.'
  }
  if (decision.needsReview) {
    return `Ihr Vertrag endet spätestens am ${endsAtText}. Ob Ihre außerordentliche Kündigung früher wirkt, prüfen wir und melden uns per E-Mail.`
  }
  if (decision.action === 'already_scheduled') return `Ihr Vertrag war bereits zum ${endsAtText} gekündigt. Dabei bleibt es.`
  if (wishBeforeEnd) {
    return `Ihr Vertrag endet am ${endsAtText}. Das ist der nächstmögliche Zeitpunkt, weil der laufende Abrechnungszeitraum erst dann endet.`
  }
  return `Ihr Vertrag endet am ${endsAtText}.`
}

/**
 * @param {{
 *   id: string,
 *   receivedAt: Date,
 *   data: { name: string, email: string, contract: string, details: string | null },
 * }} input
 * @returns {Receipt}
 */
export function buildWithdrawalReceipt({ id, receivedAt, data }) {
  const lines = [
    { label: 'Eingangs-ID', value: id },
    { label: 'Eingang', value: formatBerlinDateTime(receivedAt) },
    { label: 'Name', value: data.name },
    { label: 'E-Mail-Adresse', value: data.email },
    { label: 'Vertrag', value: contractLabel(data.contract) },
  ]
  if (data.details) lines.push({ label: 'Weitere Angaben zum Vertrag', value: data.details })

  return {
    id,
    type: 'widerruf',
    title: 'Eingangsbestätigung Ihres Widerrufs',
    statement: WITHDRAW_STATEMENT,
    submittedVia: WITHDRAW_SUBMITTED_VIA,
    receivedAt: receivedAt.toISOString(),
    receivedAtText: formatBerlinDateTime(receivedAt),
    lines,
    notice: WITHDRAWAL_NOTICE,
  }
}

/** @param {string} id */
function contactLine(id) {
  return `Fragen? Schreiben Sie an ${CONTACT_EMAIL} und nennen Sie die Eingangs-ID ${id}.`
}

/**
 * Klartext der Bestätigung von der Seite, für die Datei zum Speichern.
 * @param {Receipt} receipt
 */
export function receiptToText(receipt) {
  return [
    receipt.title,
    '',
    receipt.statement,
    receipt.submittedVia,
    '',
    ...receipt.lines.map((line) => `${line.label}: ${line.value}`),
    '',
    receipt.notice,
    '',
    contactLine(receipt.id),
    '',
    ...COMPANY_LINES,
  ].join('\n')
}

/** @param {string} value */
export function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// ---------------------------------------------------------------------------
// E-Mails
// ---------------------------------------------------------------------------

/**
 * @typedef {{ subject: string, text: string, html: string }} Mail
 */

/**
 * Setzt Text- und HTML-Fassung aus denselben Bausteinen zusammen. Alle Werte werden escaped.
 * @param {{
 *   subject: string,
 *   title: string,
 *   intro: string,
 *   statement: string,
 *   submittedVia: string,
 *   lines: ReceiptLine[],
 *   outcome: string,
 *   notes: string[],
 *   id: string,
 * }} parts
 * @returns {Mail}
 */
function renderMail(parts) {
  const text = [
    'Guten Tag,',
    '',
    parts.intro,
    '',
    parts.title,
    '',
    parts.statement,
    parts.submittedVia,
    '',
    ...parts.lines.map((line) => `${line.label}: ${line.value}`),
    '',
    parts.outcome,
    '',
    ...parts.notes.flatMap((note) => [note, '']),
    contactLine(parts.id),
    '',
    ...COMPANY_LINES,
  ].join('\n')

  const rows = parts.lines
    .map(
      (line) =>
        `<tr><td style="padding:6px 12px 6px 0;color:#475569;vertical-align:top;white-space:nowrap">${escapeHtml(line.label)}</td><td style="padding:6px 0;color:#0f172a;white-space:pre-wrap">${escapeHtml(line.value)}</td></tr>`
    )
    .join('')
  const notes = parts.notes.map((note) => `<p style="margin:0 0 16px">${escapeHtml(note)}</p>`).join('\n')

  const html = `<!doctype html><html lang="de"><body style="margin:0;padding:24px;background:#f8fafc;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:#0f172a">
<div style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;padding:24px">
<h1 style="font-size:20px;margin:0 0 16px">${escapeHtml(parts.title)}</h1>
<p style="margin:0 0 12px">Guten Tag,</p>
<p style="margin:0 0 16px">${escapeHtml(parts.intro)}</p>
<p style="margin:0 0 4px;font-weight:bold">${escapeHtml(parts.statement)}</p>
<p style="margin:0 0 16px;color:#475569">${escapeHtml(parts.submittedVia)}</p>
<table style="border-collapse:collapse;margin:0 0 16px">${rows}</table>
<p style="margin:0 0 16px;font-weight:bold">${escapeHtml(parts.outcome)}</p>
${notes}
<p style="margin:0 0 16px">Fragen? Schreiben Sie an <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a> und nennen Sie die Eingangs-ID ${escapeHtml(parts.id)}.</p>
<p style="margin:0;color:#64748b;font-size:13px">${COMPANY_LINES.map(escapeHtml).join('<br>')}</p>
</div></body></html>`

  return { subject: parts.subject, text, html }
}

const NOT_YOU_FULL =
  'Falls Sie diese Erklärung nicht selbst abgegeben haben, antworten Sie bitte auf diese E-Mail oder schreiben Sie uns.'

// Frei eingegebene Felder. Jeder, der eine hinterlegte Adresse kennt, kann sie ausfüllen. In der
// vollständigen Bestätigung (echte Mail von uns an ein Mitglied) werden Links darin deshalb
// entschärft, damit die Mail nicht als Phishing-Träger taugt. ANWALTLICH PRÜFEN.
const FREE_TEXT_LABELS = Object.freeze(['Name', 'Kündigungsgrund', 'Weitere Angaben zum Vertrag'])
const DEFANGED_NOTE =
  'Web-Adressen und E-Mail-Adressen in Ihren Freitextangaben geben wir aus Sicherheitsgründen mit [.] statt Punkt wieder, damit sie nicht anklickbar sind.'

/**
 * Macht Links, Domains und E-Mail-Adressen unklickbar ("evil.com" wird "evil[.]com"), sonst bleibt
 * der Text unverändert.
 * @param {string} value
 */
export function defangLinks(value) {
  // Idempotent: schon entschärfte Stellen ("[.]") bleiben, wenn mehrere Muster denselben Text treffen.
  const defang = (match) => match.replace(/:\/\//g, '[:]//').replace(/(?<!\[)\.(?!\])/g, '[.]')
  return String(value)
    .replace(URL_WITH_SCHEME, defang)
    .replace(WWW, defang)
    .replace(EMAIL_LIKE, defang)
    .replace(DOMAIN_LIKE, defang)
}

/**
 * Vollständige Bestätigung mit allen Angaben (und bei Kündigungen dem Vertragsende).
 * Nur an eine Adresse, die bei Stripe, Clerk oder in der PayPal-Liste zum gefundenen Vertrag
 * hinterlegt ist, oder als interne Kopie an Petar.
 * @param {Receipt} receipt
 * @param {{ outcome: string, internal?: boolean }} options internal: Kopie für Petar, wenn keine
 *   hinterlegte Adresse gefunden wurde und die vollständige Bestätigung noch aussteht.
 * @returns {Mail}
 */
export function buildConfirmationEmail(receipt, options) {
  const isCancel = receipt.type === 'kuendigung'
  const title = isCancel ? 'Bestätigung Ihrer Kündigung' : 'Eingangsbestätigung Ihres Widerrufs'
  let subject = `${title} (${receipt.id})`
  let intro = isCancel
    ? 'vielen Dank, Ihre Kündigung ist bei uns eingegangen. Hier ist die Bestätigung mit Inhalt, Datum und Uhrzeit des Eingangs. Unter Ihren Angaben steht, wann Ihr Vertrag endet.'
    : 'vielen Dank, Ihr Widerruf ist bei uns eingegangen. Hier ist die Bestätigung mit Inhalt, Datum und Uhrzeit des Eingangs.'

  let defanged = false
  const lines = receipt.lines.map((line) => {
    if (!FREE_TEXT_LABELS.includes(line.label)) return line
    const value = defangLinks(line.value)
    if (value !== line.value) defanged = true
    return { label: line.label, value }
  })

  let notes = defanged ? [DEFANGED_NOTE, NOT_YOU_FULL] : [NOT_YOU_FULL]
  if (options.internal) {
    subject = `Interne Kopie: ${subject}`
    intro =
      'interne Kopie: Zu dieser Erklärung wurde keine passende hinterlegte E-Mail-Adresse gefunden. Die vollständige Bestätigung ist noch nicht an den Kunden gegangen. Die angegebene Adresse hat höchstens eine Eingangsbestätigung ohne Vertragsdaten erhalten. Den Originaltext ohne entschärfte Links zeigt die Owner-Seite.'
    notes = []
  }

  return renderMail({
    subject,
    title,
    intro,
    statement: receipt.statement,
    submittedVia: receipt.submittedVia,
    lines,
    outcome: options.outcome,
    notes,
    id: receipt.id,
  })
}

// ---------------------------------------------------------------------------
// Neutrale Eingangsbestätigung an nicht bestätigte Adressen
// ---------------------------------------------------------------------------
//
// Missbrauchsschutz: Diese E-Mail kann an jede beliebige Adresse gehen. Sie enthält deshalb keine
// Vertragsinformationen und keinen frei eingegebenen Text außer dem bereinigten Namen (höchstens
// 80 Zeichen, ohne Links, E-Mail-Adressen und Domains). Alle übrigen Werte stammen aus festen
// Auswahllisten oder sind geprüfte Datumsangaben.

export const NEUTRAL_NAME_MAX = 80

const HTML_TAG = /<[^>]*>/g
const INVISIBLE = /\p{Cf}/gu
const CONTROL = /[\p{Cc}\p{Zl}\p{Zp}]/gu
const URL_WITH_SCHEME = /[\p{L}][\p{L}\p{N}+.-]*:\/\/\S*/giu
const WWW = /www\.\S*/giu
const EMAIL_LIKE = /\S*@\S*/gu
// \p{M}: getarnte Domains mit Kombinationszeichen (z. B. "evil.c̸om"), \.+: "evil..com".
const DOMAIN_LIKE = /[\p{L}\p{M}\p{N}_-]+(?:\.+[\p{L}\p{M}\p{N}_-]+)*\.+\p{L}[\p{L}\p{M}]+(?:[/:?#]\S*)?/gu
const BRACKETS = /[[\](){}]/g // entschärfte Links wie "evil[.]com"
const NOT_NAME_CHAR = /[^\p{L}\p{M}\s'’.-]/gu

/** @param {string} value */
function stripLinks(value) {
  let current = value
  for (let i = 0; i < 3; i++) {
    const next = current
      .replace(URL_WITH_SCHEME, ' ')
      .replace(WWW, ' ')
      .replace(EMAIL_LIKE, ' ')
      .replace(DOMAIN_LIKE, ' ')
    if (next === current) break
    current = next
  }
  return current
}

/**
 * Name für E-Mails an nicht bestätigte Adressen: ohne Links, E-Mail-Adressen, Domains, HTML,
 * Ziffern und Sonderzeichen, auf 80 Zeichen gekürzt. Leerer String, wenn nichts übrig bleibt.
 * @param {unknown} value
 * @returns {string}
 */
export function sanitizeName(value) {
  if (typeof value !== 'string') return ''
  let text = value.normalize('NFKC').replace(INVISIBLE, '').replace(HTML_TAG, ' ').replace(CONTROL, ' ')
  text = stripLinks(text)
  text = text.replace(BRACKETS, '').replace(NOT_NAME_CHAR, ' ')
  // Nach dem Entfernen von Zeichen können neue Domains entstehen (z. B. "evil[.]com").
  text = stripLinks(text)
  text = text.replace(/\s+/g, ' ').trim()
  const chars = Array.from(text)
  if (chars.length > NEUTRAL_NAME_MAX) text = chars.slice(0, NEUTRAL_NAME_MAX).join('').trim()
  return text.replace(/^[\s'’.-]+|[\s'’-]+$/g, '')
}

/**
 * @param {{
 *   type: 'kuendigung' | 'widerruf',
 *   id: string,
 *   receivedAt: Date,
 *   name: string,
 *   contract: string,
 *   kind?: string | null,
 *   timing?: string | null,
 *   requestedDate?: string | null,
 *   recipientEmail?: string | null,
 * }} input recipientEmail: nur die Adresse, an die genau diese E-Mail geht. Sie gehört zum Inhalt
 *   der Erklärung und verrät dem Empfänger nichts Neues. Andere angegebene Adressen stehen nie darin.
 * @returns {Mail}
 */
export function buildNeutralEmail(input) {
  const isCancel = input.type === 'kuendigung'
  /** @type {ReceiptLine[]} */
  const lines = [
    { label: 'Eingangs-ID', value: input.id },
    { label: 'Eingang', value: formatBerlinDateTime(input.receivedAt) },
  ]
  const name = sanitizeName(input.name)
  if (name) lines.push({ label: 'Name (wie angegeben)', value: name })
  if (input.recipientEmail) lines.push({ label: 'Angegebene E-Mail-Adresse', value: input.recipientEmail })

  const kind = KIND_OPTIONS.find((option) => option.value === input.kind)
  if (isCancel && kind) lines.push({ label: 'Art der Kündigung', value: kind.label })
  const contract = CONTRACT_OPTIONS.find((option) => option.value === input.contract)
  if (contract) lines.push({ label: 'Ausgewählter Vertrag', value: contract.label })
  if (isCancel) {
    const timing = input.timing === 'datum' ? 'datum' : 'naechstmoeglich'
    lines.push({ label: 'Gewünschtes Vertragsende', value: describeRequestedEnd({ timing, requestedDate: input.requestedDate ?? null }) })
  }

  const title = isCancel ? 'Eingangsbestätigung einer Kündigung' : 'Eingangsbestätigung eines Widerrufs'
  return renderMail({
    subject: `${title} (${input.id})`,
    title,
    intro: isCancel
      ? 'über unsere Website ist eine Kündigung eingegangen, bei der diese E-Mail-Adresse angegeben wurde. Hier ist die Eingangsbestätigung mit Datum und Uhrzeit des Eingangs.'
      : 'über unsere Website ist ein Widerruf eingegangen, bei dem diese E-Mail-Adresse angegeben wurde. Hier ist die Eingangsbestätigung mit Datum und Uhrzeit des Eingangs.',
    statement: isCancel ? CANCEL_STATEMENT : WITHDRAW_STATEMENT,
    submittedVia: isCancel ? CANCEL_SUBMITTED_VIA : WITHDRAW_SUBMITTED_VIA,
    lines,
    outcome: isCancel ? CANCELLATION_NOTICE : WITHDRAWAL_OUTCOME,
    notes: [
      'Weitere Angaben aus dem Formular geben wir in dieser E-Mail aus Sicherheitsgründen nicht wieder. Die vollständige Fassung Ihrer Erklärung konnten Sie direkt nach dem Absenden auf der Bestätigungsseite speichern.',
      'Wenn Sie diese Erklärung nicht abgegeben haben, können Sie diese E-Mail ignorieren.',
    ],
    id: input.id,
  })
}

// ---------------------------------------------------------------------------
// Einfaches Rate-Limit (pro Serverless-Instanz, im Speicher). Das dauerhafte Limit über die
// Datenbank steht in lib/vertrag-ablauf.mjs.
// ---------------------------------------------------------------------------

/**
 * @param {{ windowMs: number, max: number, maxKeys?: number }} options
 */
export function createRateLimiter({ windowMs, max, maxKeys = 5000 }) {
  /** @type {Map<string, { count: number, resetAt: number }>} */
  const hits = new Map()

  return {
    /**
     * @param {string} key
     * @param {number} [now]
     * @returns {{ limited: boolean, retryAfterSeconds: number }}
     */
    consume(key, now = Date.now()) {
      if (hits.size > maxKeys) {
        for (const [storedKey, entry] of hits) {
          if (entry.resetAt <= now) hits.delete(storedKey)
        }
        if (hits.size > maxKeys) hits.clear()
      }

      const current = hits.get(key)
      if (!current || current.resetAt <= now) {
        hits.set(key, { count: 1, resetAt: now + windowMs })
        return { limited: false, retryAfterSeconds: 0 }
      }
      if (current.count >= max) {
        return { limited: true, retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)) }
      }
      current.count += 1
      return { limited: false, retryAfterSeconds: 0 }
    },
  }
}
