// Ablauf der Freischaltung nach dem Gast-Checkout, ohne Stripe, Clerk, DB oder Mailversand: Diese
// hängt lib/checkout-fulfillment.ts als `deps` an. Tests nutzen Attrappen (lib/checkout-fulfillment.test.mjs).
//
// Idempotenz: Webhook (checkout.session.completed, async_payment_*) und /willkommen dürfen dieselbe
// Session beliebig oft und gleichzeitig freischalten. Eine Zeile CheckoutFulfillment je Session,
// Konto-Anlage, Mail, Doppel-Abo-Prüfung und Meldungen laufen über bedingte Updates (Einmal-Marken
// bzw. Sperren mit Ablaufzeit), der Rest (Stripe-Metadaten, Zugangs-Cache) ist ohnehin wiederholbar.
//
// Reihenfolge: erst Konto und Zugangs-Cache (muss vor der Weiterleitung ins Dashboard stehen), dann
// die Nebenwirkungen (Vertragsbestätigung, Doppel-Abo-Meldung). Nebenwirkungen blockieren nie.

import {
  checkFulfillable,
  decideAccount,
  findDuplicateSubscription,
  normalizeEmail,
  readCheckoutMetadata,
} from './checkout-guest.mjs'

/** Sperre für die Kontoanlage. Danach darf ein anderer Aufruf übernehmen (z. B. nach Absturz). */
export const ACCOUNT_CLAIM_LEASE_MS = 60_000
/** Sperre für einen Mailversuch. Ein Versuch dauert höchstens einige Sekunden (Timeout im Mailer). */
export const MAIL_ATTEMPT_LEASE_MS = 2 * 60_000
const ACCOUNT_WAIT_ATTEMPTS = 8
const ACCOUNT_WAIT_MS = 1_000
// Hält ein anderer Aufruf die Mail-Sperre (z. B. /willkommen, während der Webhook läuft), kurz auf
// dessen Ergebnis warten. Der Mailer bricht nach 8 s ab, danach steht welcomeEmailSentAt oder nicht.
const MAIL_WAIT_ATTEMPTS = 10
const MAIL_WAIT_MS = 1_000

/** Mailfehler, die sich nicht durch Wiederholen beheben (fehlende oder falsche Konfiguration). */
const PERMANENT_MAIL_FAILURES = new Set(['not_configured', 'invalid_config', 'invalid_message'])

export class FulfillmentError extends Error {
  /**
   * @param {'incomplete_session' | 'account_pending'} code
   * @param {string} message
   */
  constructor(code, message) {
    super(message)
    this.name = 'FulfillmentError'
    this.code = code
  }
}

/**
 * @typedef {{
 *   stripeSessionId: string,
 *   flow: string,
 *   email: string,
 *   userId: string | null,
 *   createdNewUser: boolean,
 *   stripeCustomerId: string | null,
 *   stripeSubscriptionId: string | null,
 *   nonceHash: string | null,
 *   ticketIssuedAt: Date | null,
 *   welcomeEmailSentAt: Date | null,
 *   purchaseTrackedAt: Date | null,
 *   createdAt: Date,
 * }} FulfillmentRecord
 *
 * @typedef {'ticketIssuedAt' | 'duplicateCheckedAt' | 'paymentFailedNotifiedAt' | 'purchaseTrackedAt'} OnceField
 *
 * @typedef {{
 *   ensure: (data: { stripeSessionId: string, flow: string, email: string, nonceHash: string | null, stripeCustomerId: string, stripeSubscriptionId: string }) => Promise<FulfillmentRecord>,
 *   get: (stripeSessionId: string) => Promise<FulfillmentRecord | null>,
 *   claimAccount: (stripeSessionId: string, now: Date, staleBefore: Date) => Promise<boolean>,
 *   setAccount: (stripeSessionId: string, data: { userId: string, createdNewUser: boolean }) => Promise<boolean>,
 *   claimMail: (stripeSessionId: string, now: Date, staleBefore: Date) => Promise<boolean>,
 *   markMailSent: (stripeSessionId: string, now: Date) => Promise<void>,
 *   claimOnce: (stripeSessionId: string, field: OnceField, now: Date) => Promise<boolean>,
 * }} FulfillmentStore
 *
 * @typedef {{ subject: string, text: string, html: string }} Mail
 *
 * @typedef {{
 *   now: () => Date,
 *   sleep: (ms: number) => Promise<void>,
 *   store: FulfillmentStore,
 *   retrieveSession: (sessionId: string) => Promise<any>,
 *   retrieveSubscription: (subscriptionId: string) => Promise<any>,
 *   getAccount: (userId: string) => Promise<{ id: string, isAdmin: boolean } | null>,
 *   findAccountsByEmail: (email: string) => Promise<Array<{ id: string, verified: boolean, isAdmin: boolean }>>,
 *   createAccount: (input: { email: string, name: string | null, stripeSessionId: string }) => Promise<{ id: string }>,
 *   createLoginLink: (userId: string) => Promise<string | null>,
 *   linkStripe: (input: { customerId: string, subscriptionId: string, userId: string }) => Promise<void>,
 *   upsertSubscription: (input: { userId: string, customerId: string, subscription: any }) => Promise<void>,
 *   listSubscriptionsForDuplicateCheck: (input: { userId: string, email: string, customerId: string }) => Promise<{ subscriptions: Array<{ id: string, status: string, product?: string | null, priceIds?: string[] }>, paypalActive: boolean, mentorshipPriceIds: string[] }>,
 *   buildConfirmationMail: (input: ConfirmationMailInput) => Mail,
 *   buildPaymentFailedMail: (input: { name: string | null }) => Mail,
 *   sendMail: (mail: Mail & { to: string }, tag: string) => Promise<{ ok: true } | { ok: false, reason: string }>,
 *   notify: (lines: string[]) => Promise<void>,
 * }} FulfillmentDeps
 *
 * @typedef {{
 *   email: string,
 *   name: string | null,
 *   subscriptionId: string,
 *   amountTotal: number | null,
 *   currency: string | null,
 *   startedAt: Date,
 *   currentPeriodEnd: Date | null,
 *   consentEarlyStart: boolean,
 *   consentAt: string | null,
 *   termsVersion: string | null,
 *   createdNewUser: boolean,
 *   loginUrl: string | null,
 * }} ConfirmationMailInput
 *
 * @typedef {{ mail: 'sent' | 'skipped' | 'in_progress' | 'failed_transient' | 'failed_permanent', duplicate: 'none' | 'notified' | 'skipped' | 'failed' }} SideEffectResult
 *   mail 'skipped': schon versendet. 'in_progress': ein anderer Versuch hält die Sperre und war nach
 *   kurzem Warten nicht erfolgreich (der Webhook meldet dann einen Fehler, damit Stripe erneut zustellt).
 */

/** @param {unknown} value */
function idOf(value) {
  if (typeof value === 'string') return value
  if (value && typeof value === 'object' && typeof (/** @type {any} */ (value).id) === 'string') return /** @type {any} */ (value).id
  return null
}

/**
 * @param {FulfillmentDeps} deps
 * @param {string[]} lines
 */
async function safeNotify(deps, lines) {
  try {
    await deps.notify(lines)
  } catch (error) {
    console.error('[checkout] notify failed (non-fatal):', error)
  }
}

/**
 * Konto bestimmen oder anlegen. Nur der Aufruf mit der Sperre legt an, alle anderen warten kurz.
 * @param {{ session: any, meta: ReturnType<typeof readCheckoutMetadata>, email: string, record: FulfillmentRecord }} input
 * @param {FulfillmentDeps} deps
 * @returns {Promise<{ record: FulfillmentRecord, notice: 'admin' | null }>}
 */
async function resolveAccount({ session, meta, email, record }, deps) {
  const sessionId = record.stripeSessionId
  const now = deps.now()
  const claimed = await deps.store.claimAccount(sessionId, now, new Date(now.getTime() - ACCOUNT_CLAIM_LEASE_MS))

  if (!claimed) {
    for (let attempt = 0; attempt < ACCOUNT_WAIT_ATTEMPTS; attempt++) {
      await deps.sleep(ACCOUNT_WAIT_MS)
      const current = await deps.store.get(sessionId)
      if (current?.userId) return { record: current, notice: null }
    }
    return { record: (await deps.store.get(sessionId)) ?? record, notice: null }
  }

  const accountUser = meta.flow === 'account' && meta.userId ? await deps.getAccount(meta.userId) : null
  const matches = accountUser ? [] : await deps.findAccountsByEmail(email)
  let decision = decideAccount({ flow: /** @type {'guest' | 'account'} */ (meta.flow), accountUser, matches })

  /** @type {string} */
  let userId
  let createdNewUser = false
  if (decision.action === 'create') {
    try {
      const created = await deps.createAccount({
        email,
        name: typeof session?.customer_details?.name === 'string' ? session.customer_details.name : null,
        stripeSessionId: sessionId,
      })
      userId = created.id
      createdNewUser = true
    } catch (error) {
      // Z. B. wurde das Konto gerade woanders angelegt (E-Mail vergeben): noch einmal nachsehen.
      decision = decideAccount({ flow: 'guest', matches: await deps.findAccountsByEmail(email) })
      if (decision.action !== 'link') throw error
      userId = decision.userId
    }
  } else {
    userId = decision.userId
  }

  const won = await deps.store.setAccount(sessionId, { userId, createdNewUser })
  const current = (await deps.store.get(sessionId)) ?? record
  const notice = won && decision.action === 'link' && decision.notifyAdmin ? 'admin' : null
  return { record: current, notice }
}

/**
 * Vertragsbestätigung nach § 312f BGB, höchstens einmal erfolgreich.
 * @param {{ session: any, meta: ReturnType<typeof readCheckoutMetadata>, email: string, record: FulfillmentRecord, subscription: any, subscriptionId: string }} ctx
 * @param {FulfillmentDeps} deps
 * @returns {Promise<SideEffectResult['mail']>}
 */
async function sendConfirmationOnce(ctx, deps) {
  const sessionId = ctx.record.stripeSessionId
  if (ctx.record.welcomeEmailSentAt) return 'skipped'
  const now = deps.now()
  const claimed = await deps.store.claimMail(sessionId, now, new Date(now.getTime() - MAIL_ATTEMPT_LEASE_MS))
  if (!claimed) {
    // Nicht einfach 'skipped': Scheitert der andere Versuch (z. B. /willkommen) vorübergehend, muss
    // der Webhook trotzdem fehlschlagen, sonst stellt Stripe nicht erneut zu und die Mail fehlt.
    for (let attempt = 0; attempt < MAIL_WAIT_ATTEMPTS; attempt++) {
      const current = await deps.store.get(sessionId)
      if (!current || current.welcomeEmailSentAt) return 'skipped'
      await deps.sleep(MAIL_WAIT_MS)
    }
    const current = await deps.store.get(sessionId)
    return !current || current.welcomeEmailSentAt ? 'skipped' : 'in_progress'
  }

  let loginUrl = null
  if (ctx.record.createdNewUser && ctx.record.userId) {
    loginUrl = await deps.createLoginLink(ctx.record.userId).catch((error) => {
      console.error('[checkout] login link failed (mail goes out without it):', error)
      return null
    })
  }

  const startedUnix = ctx.subscription?.start_date ?? ctx.session?.created
  const periodEndUnix = ctx.subscription?.current_period_end
  const mail = deps.buildConfirmationMail({
    email: ctx.email,
    name: typeof ctx.session?.customer_details?.name === 'string' ? ctx.session.customer_details.name : null,
    subscriptionId: ctx.subscriptionId,
    amountTotal: typeof ctx.session?.amount_total === 'number' ? ctx.session.amount_total : null,
    currency: typeof ctx.session?.currency === 'string' ? ctx.session.currency : null,
    startedAt: typeof startedUnix === 'number' ? new Date(startedUnix * 1000) : now,
    currentPeriodEnd: typeof periodEndUnix === 'number' ? new Date(periodEndUnix * 1000) : null,
    consentEarlyStart: ctx.meta.consentEarlyStart,
    consentAt: ctx.meta.consentAt,
    termsVersion: ctx.meta.termsVersion,
    createdNewUser: ctx.record.createdNewUser,
    loginUrl,
  })

  const result = await deps.sendMail({ to: ctx.email, ...mail }, 'kauf-bestaetigung')
  if (result.ok) {
    await deps.store.markMailSent(sessionId, deps.now())
    return 'sent'
  }

  const permanent = PERMANENT_MAIL_FAILURES.has(result.reason)
  await safeNotify(deps, [
    'Mentorship-Kauf: Vertragsbestätigung nicht versendet',
    `Stripe-Abo: ${ctx.subscriptionId}`,
    `Grund: ${result.reason}`,
    permanent
      ? 'Mailversand ist nicht eingerichtet: Bestätigung bitte manuell senden (§ 312f BGB).'
      : 'Neuer Versuch beim nächsten Webhook-Versuch von Stripe oder Aufruf von /willkommen.',
  ])
  return permanent ? 'failed_permanent' : 'failed_transient'
}

/**
 * Doppel-Abo melden (ohne Personendaten), höchstens einmal je Session.
 * @param {{ email: string, record: FulfillmentRecord, customerId: string, subscriptionId: string }} ctx
 * @param {FulfillmentDeps} deps
 * @returns {Promise<SideEffectResult['duplicate']>}
 */
async function checkDuplicateOnce(ctx, deps) {
  const claimed = await deps.store.claimOnce(ctx.record.stripeSessionId, 'duplicateCheckedAt', deps.now())
  if (!claimed || !ctx.record.userId) return 'skipped'
  try {
    const facts = await deps.listSubscriptionsForDuplicateCheck({
      userId: ctx.record.userId,
      email: ctx.email,
      customerId: ctx.customerId,
    })
    const result = findDuplicateSubscription({
      subscriptions: facts.subscriptions,
      newSubscriptionId: ctx.subscriptionId,
      mentorshipPriceIds: facts.mentorshipPriceIds,
      paypalActive: facts.paypalActive,
    })
    if (!result.duplicate) return 'none'
    await safeNotify(deps, [
      'Mentorship-Kauf: mögliches Doppel-Abo',
      `Neues Stripe-Abo: ${ctx.subscriptionId}`,
      result.kind === 'stripe'
        ? `Bestehendes Stripe-Abo: ${result.subscriptionId} (${result.status})`
        : 'Bestehender Zugang: aktives PayPal-Abo',
      'Bitte prüfen und ggf. erstatten. Beim Erstatten das NEUE Abo in Stripe beenden und danach am bestehenden Stripe-Abo einmal etwas speichern (z. B. Metadaten), damit der Zugangs-Cache wieder darauf zeigt.',
    ])
    return 'notified'
  } catch (error) {
    console.error('[checkout] duplicate check failed:', error)
    await safeNotify(deps, [
      'Mentorship-Kauf: Doppel-Abo-Prüfung fehlgeschlagen',
      `Neues Stripe-Abo: ${ctx.subscriptionId}`,
      'Bitte in Stripe prüfen, ob zur E-Mail des Käufers schon ein laufendes Mentorship-Abo besteht.',
    ])
    return 'failed'
  }
}

/**
 * Checkout-Session freischalten. Idempotent.
 * @param {string} sessionId
 * @param {FulfillmentDeps} deps
 * @param {{ defer?: (task: () => Promise<unknown>) => void }} [options] defer: Nebenwirkungen nach der
 *   Antwort ausführen (z. B. `after` auf /willkommen). Ohne defer laufen sie sofort und fließen ins Ergebnis.
 * @returns {Promise<
 *   | { status: 'skipped', reason: string, session: any }
 *   | { status: 'pending', session: any, record: FulfillmentRecord }
 *   | { status: 'fulfilled', session: any, record: FulfillmentRecord, subscription: any, sideEffects: SideEffectResult | 'deferred' }
 * >}
 */
export async function fulfillCheckoutSessionFlow(sessionId, deps, options = {}) {
  const session = await deps.retrieveSession(sessionId)
  const check = checkFulfillable(session)
  if (!check.ok) return { status: 'skipped', reason: check.reason, session }

  const meta = readCheckoutMetadata(session)
  const email = normalizeEmail(session.customer_details?.email ?? session.customer_email)
  const customerId = idOf(session.customer)
  const subscriptionId = idOf(session.subscription)
  if (!email || !customerId || !subscriptionId) {
    throw new FulfillmentError('incomplete_session', `Checkout session ${sessionId} has no email, customer or subscription`)
  }

  let record = await deps.store.ensure({
    stripeSessionId: session.id,
    flow: /** @type {string} */ (meta.flow),
    email,
    nonceHash: meta.nonceHash,
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscriptionId,
  })

  /** @type {'admin' | null} */
  let notice = null
  if (!record.userId) {
    const resolved = await resolveAccount({ session, meta, email, record }, deps)
    record = resolved.record
    notice = resolved.notice
    if (!record.userId) return { status: 'pending', session, record }
  }
  const userId = /** @type {string} */ (record.userId)

  // Muss stehen, bevor /willkommen ins Dashboard weiterleitet.
  await deps.linkStripe({ customerId, subscriptionId, userId })
  const subscription = await deps.retrieveSubscription(subscriptionId)
  await deps.upsertSubscription({ userId, customerId, subscription })

  const ctx = { session, meta, email, record, subscription, customerId, subscriptionId }
  const runSideEffects = async () => {
    if (notice === 'admin') {
      await safeNotify(deps, [
        'Mentorship-Kauf mit der E-Mail-Adresse eines Admin-Kontos',
        `Stripe-Abo: ${subscriptionId}`,
        'Das Abo wurde dem Admin-Konto zugeordnet, keine automatische Anmeldung. Bitte prüfen.',
      ])
    }
    /** @type {SideEffectResult} */
    const result = { mail: 'skipped', duplicate: 'skipped' }
    try {
      result.mail = await sendConfirmationOnce(ctx, deps)
    } catch (error) {
      console.error('[checkout] confirmation mail step failed:', error)
      result.mail = 'failed_transient'
      await safeNotify(deps, ['Mentorship-Kauf: Fehler vor dem Versand der Vertragsbestätigung', `Stripe-Abo: ${subscriptionId}`])
    }
    result.duplicate = await checkDuplicateOnce(ctx, deps)
    return result
  }

  if (options.defer) {
    options.defer(() =>
      runSideEffects().catch((error) => {
        console.error('[checkout] deferred side effects failed:', error)
      })
    )
    return { status: 'fulfilled', session, record, subscription, sideEffects: 'deferred' }
  }

  return { status: 'fulfilled', session, record, subscription, sideEffects: await runSideEffects() }
}

/**
 * SEPA und andere verzögerte Zahlungsarten: Zahlung ist nach dem Checkout gescheitert.
 * Zugangs-Cache aktualisieren (Stripe-Status), Petar melden und den Käufer informieren, je einmal.
 * @param {string} sessionId
 * @param {FulfillmentDeps} deps
 */
export async function handleAsyncPaymentFailedFlow(sessionId, deps) {
  const result = await fulfillCheckoutSessionFlow(sessionId, deps)
  if (result.status !== 'fulfilled') return result

  const claimed = await deps.store.claimOnce(result.record.stripeSessionId, 'paymentFailedNotifiedAt', deps.now())
  if (!claimed) return result

  const subscriptionId = idOf(result.session.subscription)
  await safeNotify(deps, [
    'Mentorship-Kauf: verzögerte Zahlung fehlgeschlagen (z. B. SEPA-Lastschrift)',
    `Stripe-Abo: ${subscriptionId} (Status jetzt: ${result.subscription?.status ?? '?'})`,
    'Der Zugang richtet sich nach dem Stripe-Status. Käufer wurde per E-Mail informiert.',
  ])
  const mail = deps.buildPaymentFailedMail({
    name: typeof result.session?.customer_details?.name === 'string' ? result.session.customer_details.name : null,
  })
  const sent = await deps.sendMail({ to: result.record.email, ...mail }, 'kauf-zahlung-fehlgeschlagen')
  if (!sent.ok) {
    await safeNotify(deps, ['Mentorship-Kauf: Hinweis zur fehlgeschlagenen Zahlung nicht versendet', `Stripe-Abo: ${subscriptionId}`, `Grund: ${sent.reason}`])
  }
  return result
}
